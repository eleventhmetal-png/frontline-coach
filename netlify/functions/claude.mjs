import { createClient } from "@supabase/supabase-js";
import { reservePointsFor, actualPointsFor, PLAN_LIMITS } from "../../src/lib/credits.js";

// Per-plan output ceiling. Free covers the heaviest real tool call (Coach ~2500);
// paid leaves headroom for longer outputs later. A caller can't exceed their tier
// no matter what max_tokens they send. Plan lives in the user's Supabase
// app_metadata (only the service role / dashboard can set it — users can't
// self-upgrade), and defaults to "free" until billing sets it.
const TIER_MAX_TOKENS = { free: 3000, paid: 8000, premium: 8000 };

// Only models the app actually uses. Blocks a caller from forcing an
// arbitrary/expensive model through the proxy.
const ALLOWED_MODELS = new Set(["claude-sonnet-5", "claude-haiku-4-5-20251001"]);
const DEFAULT_MODEL = "claude-sonnet-5";

// Env var name matches stripe-webhook.mjs and synthesize-memory.mjs.
const SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY";

export default async (req) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "Server is missing ANTHROPIC_API_KEY" }, 500);

  // --- Auth gate: require a valid Supabase session ---------------------------
  // No anonymous access. Without this, the endpoint is an open proxy to Claude
  // on our API key — anyone could burn the spend cap or use it as free API access.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return json({ error: "Server auth not configured" }, 500);

  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) return json({ error: "Sign in required" }, 401);

  let plan = "free";
  let userId = null;
  try {
    const supa = createClient(supabaseUrl, anonKey);
    const { data, error } = await supa.auth.getUser(token); // verifies the JWT with Supabase
    if (error || !data?.user) return json({ error: "Invalid or expired session" }, 401);
    userId = data.user.id;
    const claimed = data.user.app_metadata?.plan;
    plan = claimed === "premium" ? "premium" : claimed === "paid" ? "paid" : "free";
  } catch (e) {
    return json({ error: "Auth check failed" }, 401);
  }

  try {
    const { messages, max_tokens, model, system, temperature, stream } = await req.json();
    if (!Array.isArray(messages)) return json({ error: "messages is required" }, 400);

    const chosenModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
    const cap = TIER_MAX_TOKENS[plan] || TIER_MAX_TOKENS.free;
    const cappedMax = Math.min(Number(max_tokens) || 1000, cap);

    // --- Usage metering ------------------------------------------------------
    // Charged from the payload we were actually sent (measured input size,
    // requested model, capped max_tokens) rather than a tool label from the
    // client. A caller can lie about which feature they're using; they can't
    // lie about the request that determines the bill.
    //
    // Spend BEFORE calling upstream, not after. Two concurrent requests from the
    // same user must not both pass the check — consume_credits() is an atomic
    // upsert-and-increment, so the second one sees the first one's total.
    // Refunded below if the upstream call fails.
    const cost = reservePointsFor({ model: chosenModel, system, messages, max_tokens: cappedMax });
    const limit = (PLAN_LIMITS[plan] || PLAN_LIMITS.free).points;

    const serviceRoleKey = process.env[SERVICE_ROLE_ENV];
    let admin = null;
    let spent = false;

    if (serviceRoleKey) {
      admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: total, error: spendErr } = await admin.rpc("consume_credits", {
        p_user_id: userId,
        p_points: cost,
      });
      if (spendErr) {
        // Meter unavailable. Fail OPEN rather than locking every user out of the
        // product over a database hiccup — the Anthropic spend cap is still the
        // hard backstop. Logged so it's visible in function logs.
        console.error("consume_credits failed, allowing request:", spendErr.message);
      } else {
        spent = true;
        // ── Record now, enforce later ────────────────────────────────────────
        // Paid pricing doesn't go live until the beta closes on 2026-11-15, and
        // the beta deal is that testers get the FULL product with no caps — a
        // throttled beta produces worse feedback and less goodwill, at exactly
        // the moment both matter most.
        //
        // So metering RECORDS from day one and only REFUSES once
        // METERING_ENFORCE=true is set in Netlify env. Two months of real
        // per-user cost data is also the only honest basis for setting the final
        // free-tier ceiling — better than the estimates in credits.js.
        const enforcing = process.env.METERING_ENFORCE === "true";
        if (enforcing && total > limit) {
          // Over budget. Give the points back so the rejected call doesn't
          // count against them, then refuse.
          await admin.rpc("refund_credits", { p_user_id: userId, p_points: cost }).catch(() => {});
          return json(
            {
              error: "You're out of AI credits for today.",
              code: "OUT_OF_CREDITS",
              cost,
              limit,
              used: total - cost,
            },
            429
          );
        }
      }
    } else {
      // Without the service role key there is no meter at all. Loud, because
      // shipping this way means free users are effectively unlimited.
      console.error(`${SERVICE_ROLE_ENV} not set — usage metering is DISABLED`);
    }

    const upstreamBody = {
      model: chosenModel,
      max_tokens: cappedMax,
      messages,
      ...(system ? { system } : {}),
      ...(temperature != null ? { temperature } : {}),
      ...(stream ? { stream: true } : {}),
    };

    const refund = async () => {
      if (spent && admin) {
        try { await admin.rpc("refund_credits", { p_user_id: userId, p_points: cost }); }
        catch (e) { /* best effort */ }
      }
    };

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(upstreamBody),
      });
    } catch (e) {
      await refund();
      throw e;
    }

    // Upstream rejected it — don't charge for a call that produced nothing.
    if (!upstream.ok) await refund();

    // Trues the reserve up to what the call actually cost. The reserve bills
    // 35% of max_tokens; real output varies from ~15% (a roleplay turn) to ~50%
    // (a JSON tool), so leaving the reserve in place would over- or under-charge
    // by roughly 2x depending on the tool.
    const reconcile = async (inputTokens, outputTokens) => {
      if (!spent || !admin) return;
      const actual = actualPointsFor({ model: chosenModel, inputTokens, outputTokens });
      const delta = actual - cost;
      try {
        if (delta > 0) await admin.rpc("consume_credits", { p_user_id: userId, p_points: delta });
        else if (delta < 0) await admin.rpc("refund_credits", { p_user_id: userId, p_points: -delta });
      } catch (e) { /* best effort — the reserve stands if this fails */ }
    };

    if (stream) {
      // Pass the SSE through untouched while watching it go by, so the usage
      // block in message_start / message_delta can be read for reconciliation.
      // The client sees exactly the same bytes at the same time.
      let inTok = 0, outTok = 0, tail = "";
      const watcher = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
          try {
            tail += new TextDecoder().decode(chunk, { stream: true });
            const lines = tail.split("\n");
            tail = lines.pop() || "";
            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const evt = JSON.parse(t.slice(5).trim());
              if (evt?.message?.usage?.input_tokens) inTok = evt.message.usage.input_tokens;
              if (evt?.usage?.output_tokens) outTok = evt.usage.output_tokens;
            }
          } catch (e) { /* never let metering break the stream */ }
        },
        flush() {
          if (outTok > 0) reconcile(inTok, outTok);
        },
      });

      return new Response(upstream.body.pipeThrough(watcher), {
        status: upstream.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          // Lets the client move the meter immediately. This is the reserve, so
          // the pill can drift slightly from the reconciled total until its next
          // read — close enough for a 0–100 display.
          "X-Credits-Cost": String(cost),
        },
      });
    }

    const data = await upstream.json();
    if (upstream.ok) {
      await reconcile(data?.usage?.input_tokens, data?.usage?.output_tokens);
    }
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "X-Credits-Cost": String(cost) },
    });
  } catch (err) {
    return json({ error: "Upstream request failed" }, 500);
  }
};
