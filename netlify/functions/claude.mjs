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

// --- Upstream retry ---------------------------------------------------------
// Anthropic returns 529 overloaded_error and transient 500s under load, and the
// old code passed them straight through. The client mapped anything >= 500 to
// "Something went wrong on our end" — so the USER was the retry loop, tapping
// the button two or three times until one attempt happened to land. Retrying
// here is safe because nothing has been written to the client yet.
//
// The budget is deliberately small. Netlify's sync function timeout is 10s and
// what matters on the streaming path is time-to-first-byte, so a generous retry
// ladder would trade one visible failure for a worse one (a platform timeout
// with no refund). Attempts stop as soon as RETRY_DEADLINE_MS is spent.
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 522, 524, 529]);
const MAX_ATTEMPTS = 3;
const RETRY_DEADLINE_MS = 5000;   // total time allowed for backoff + re-attempts
const ATTEMPT_TIMEOUT_MS = 20000; // a hung socket must not hold the invocation open

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Honour Retry-After when the server sends one, but never wait longer than the
// budget — a 60s Retry-After is not actionable inside a 10s function.
function backoffFor(attempt, res) {
  const hinted = Number(res?.headers?.get?.("retry-after"));
  const hintMs = Number.isFinite(hinted) && hinted > 0 ? hinted * 1000 : 0;
  const base = 400 * Math.pow(2, attempt);           // 400ms, 800ms
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(Math.max(base, hintMs), 2000) + jitter;
}

async function fetchAnthropic(body, key) {
  const startedAt = Date.now();
  let lastErr = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ATTEMPT_TIMEOUT_MS);
    let res = null;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(t);
    }

    if (res && !RETRYABLE.has(res.status)) return res;

    const last = attempt === MAX_ATTEMPTS - 1;
    const wait = backoffFor(attempt, res);
    const spent = Date.now() - startedAt;
    // Out of budget, or out of attempts: hand back whatever we have. A
    // retryable status still reaches the client, it just reaches it after we
    // tried — the client shows the same message it always did.
    if (last || spent + wait > RETRY_DEADLINE_MS) {
      if (res) return res;
      throw lastErr || new Error("upstream unavailable");
    }
    console.warn(
      `anthropic ${res ? res.status : "network error"} — retry ${attempt + 1}/${MAX_ATTEMPTS - 1} in ${wait}ms`
    );
    await sleep(wait);
  }
  throw lastErr || new Error("upstream unavailable");
}

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

  // Parsed OUTSIDE the main try. A malformed or truncated body (aborted upload,
  // mobile network blip mid-POST) used to land in the catch-all below and return
  // 500 "Upstream request failed" — a lie, since no upstream request happened,
  // and it made a client bug indistinguishable from a server outage in the logs.
  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return json({ error: "Malformed request body" }, 400);
  }

  try {
    const { messages, max_tokens, model, system, temperature, stream } = payload || {};
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

      // --- Trial gate ---------------------------------------------------------
      // Unpaid accounts get access until profiles.trial_ends_at. During the beta
      // that's 15 Nov 2026 for everybody; afterwards it's signup + 7 days.
      //
      // Checked HERE rather than in the client because the client is the thing
      // being gated. A React check is a suggestion; this is the wall.
      //
      // Nobody is charged when it expires — there's no card on file. The call is
      // refused, the app shows a paywall, and the user chooses. That's the whole
      // point of the no-card model.
      if (plan === "free") {
        const { data: prof, error: profErr } = await admin
          .from("profiles")
          .select("trial_ends_at")
          .eq("id", userId)
          .maybeSingle();

        // Fail OPEN on a read error. A database hiccup must not lock a paying-
        // adjacent user out of a coaching conversation they're mid-way through.
        if (!profErr && prof?.trial_ends_at && new Date(prof.trial_ends_at) < new Date()) {
          return json(
            {
              error: "Your free trial has ended.",
              code: "TRIAL_ENDED",
              trialEndedAt: prof.trial_ends_at,
            },
            402
          );
        }
      }
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
          //
          // NOT `.catch()`. A Supabase query builder is only PromiseLike — it
          // implements then() and nothing else — so `.rpc(...).catch(...)`
          // throws "catch is not a function" SYNCHRONOUSLY, before the RPC is
          // ever sent. That fell into the outer catch and returned 500 instead
          // of this 429, the refund never happened, and every retry reserved
          // more points against a balance that could never come back. Dormant
          // only because METERING_ENFORCE isn't on yet; it would have detonated
          // the day it was.
          try {
            await admin.rpc("refund_credits", { p_user_id: userId, p_points: cost });
            spent = false;
          } catch (e) {
            console.error("refund_credits failed after over-limit refusal:", e?.message);
          }
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

    // Idempotent: flips `spent` so a later reconcile() can't charge a delta
    // against a reserve that no longer exists, and a second refund() is a no-op.
    const refund = async () => {
      if (!spent || !admin) return;
      spent = false;
      try { await admin.rpc("refund_credits", { p_user_id: userId, p_points: cost }); }
      catch (e) { console.error("refund_credits failed:", e?.message); }
    };

    let upstream;
    try {
      upstream = await fetchAnthropic(upstreamBody, key);
    } catch (e) {
      await refund();
      throw e;
    }

    // Upstream rejected it — don't charge for a call that produced nothing, and
    // return a real JSON error. The old code kept going into the stream branch
    // and shipped a JSON error body under `Content-Type: text/event-stream`,
    // with an `X-Credits-Cost` header for points it had just refunded. This
    // client survived that by checking res.ok first; anything keying on content
    // type (EventSource, a service worker, a future mobile client) would have
    // waited forever for a `data:` line that never came.
    if (!upstream.ok) {
      await refund();
      const errBody = await upstream.text().catch(() => "");
      let parsed = null;
      try { parsed = JSON.parse(errBody); } catch (e) { /* not JSON */ }
      console.error(`anthropic ${upstream.status}: ${errBody.slice(0, 500)}`);
      return json(
        parsed || { error: "Upstream request failed", status: upstream.status },
        upstream.status
      );
    }

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
      // A 200 with no body is rare but real (an intermediary collapsing the
      // response). `null.pipeThrough` threw a TypeError that the outer catch
      // turned into a 500 "Upstream request failed", masking the fact that the
      // call had actually been billed.
      if (!upstream.body) {
        await refund();
        return json({ error: "Upstream returned an empty response" }, 502);
      }

      // Pass the SSE through untouched while watching it go by, so the usage
      // block in message_start / message_delta can be read for reconciliation.
      // The client sees exactly the same bytes at the same time.
      //
      // The decoder is built ONCE, outside transform(). Constructing a fresh one
      // per chunk made `{stream: true}` inert: a multi-byte character split
      // across a chunk boundary buffered its trailing bytes into a decoder that
      // was thrown away, and the continuation bytes decoded to U+FFFD on the
      // next call. Line splitting survived (\n is never part of a multi-byte
      // sequence) but a corrupted usage event failed JSON.parse, and because the
      // try wrapped the whole loop, `tail` had already been reassigned — those
      // events were gone, outTok stayed 0, and reconciliation silently skipped.
      const decoder = new TextDecoder();
      let inTok = 0, outTok = 0, tail = "";
      const watcher = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
          try {
            tail += decoder.decode(chunk, { stream: true });
            const lines = tail.split("\n");
            tail = lines.pop() || "";
            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              // Per-line try: one unparseable event must not discard the rest
              // of the chunk's events.
              try {
                const evt = JSON.parse(t.slice(5).trim());
                if (evt?.message?.usage?.input_tokens) inTok = evt.message.usage.input_tokens;
                if (evt?.usage?.output_tokens) outTok = evt.usage.output_tokens;
              } catch (e) { /* not a usage event we care about */ }
            }
          } catch (e) { /* never let metering break the stream */ }
        },
        // RETURNED, not fired and forgotten. Netlify runs on Lambda, which
        // freezes the execution environment the moment the response completes —
        // an un-awaited Supabase RPC here could simply never finish, losing the
        // true-up. Returning the promise makes the stream machinery wait for it.
        flush() {
          if (outTok > 0) return reconcile(inTok, outTok);
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

    // Reading the body can fail on a 200 (connection reset mid-read, truncated
    // body, an HTML error page injected by an intermediary). That used to skip
    // the refund entirely — refund() only ran under `if (!upstream.ok)` — so the
    // user was charged for a response they never received.
    let data;
    try {
      data = await upstream.json();
    } catch (e) {
      await refund();
      console.error("failed reading upstream body:", e?.message);
      return json({ error: "Upstream response was unreadable" }, 502);
    }

    await reconcile(data?.usage?.input_tokens, data?.usage?.output_tokens);
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "X-Credits-Cost": String(cost) },
    });
  } catch (err) {
    // Logged. Without this, every 500 a user reported was invisible in the
    // function logs — four distinct failure modes collapsed into one opaque
    // message with nothing to diagnose from.
    console.error("claude proxy failed:", err?.stack || err?.message || err);
    return json({ error: "Upstream request failed" }, 500);
  }
};
