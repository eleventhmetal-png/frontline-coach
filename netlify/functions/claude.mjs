import { createClient } from "@supabase/supabase-js";

// Per-plan output ceiling. Free covers the heaviest real tool call (Coach ~2500);
// paid leaves headroom for longer outputs later. A caller can't exceed their tier
// no matter what max_tokens they send. Plan lives in the user's Supabase
// app_metadata (only the service role / dashboard can set it — users can't
// self-upgrade), and defaults to "free" until billing sets it.
const TIER_MAX_TOKENS = { free: 3000, paid: 8000 };

// Only models the app actually uses. Blocks a caller from forcing an
// arbitrary/expensive model through the proxy.
const ALLOWED_MODELS = new Set(["claude-sonnet-5", "claude-haiku-4-5-20251001"]);
const DEFAULT_MODEL = "claude-sonnet-5";

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
  try {
    const supa = createClient(supabaseUrl, anonKey);
    const { data, error } = await supa.auth.getUser(token); // verifies the JWT with Supabase
    if (error || !data?.user) return json({ error: "Invalid or expired session" }, 401);
    plan = data.user.app_metadata?.plan === "paid" ? "paid" : "free";
  } catch (e) {
    return json({ error: "Auth check failed" }, 401);
  }

  try {
    const { messages, max_tokens, model, system, temperature, stream } = await req.json();
    if (!Array.isArray(messages)) return json({ error: "messages is required" }, 400);

    const chosenModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
    const cap = TIER_MAX_TOKENS[plan] || TIER_MAX_TOKENS.free;
    const cappedMax = Math.min(Number(max_tokens) || 1000, cap);

    const upstreamBody = {
      model: chosenModel,
      max_tokens: cappedMax,
      messages,
      ...(system ? { system } : {}),
      ...(temperature != null ? { temperature } : {}),
      ...(stream ? { stream: true } : {}),
    };

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(upstreamBody),
    });

    if (stream) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await upstream.json();
    return json(data, upstream.status);
  } catch (err) {
    return json({ error: "Upstream request failed" }, 500);
  }
};
