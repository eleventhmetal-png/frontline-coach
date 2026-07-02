// Netlify Function (v2). Holds the API key server-side; the browser never sees it.
// Reached at /api/claude via the redirect in netlify.toml.
//
// UPDATE 2026-07-02: rate limiting + input caps added.
// - Each visitor (by IP) gets RATE_LIMIT calls per rolling hour. Real users never
//   hit this; scripts hammering the endpoint get a 429 and stop burning budget.
// - max_tokens is capped server-side so a scripted caller can't request huge outputs.
// - Oversized request bodies are rejected.
// Note: the counter lives in function memory. It resets on cold starts and isn't
// shared across instances, which is fine at pilot scale — sustained abuse keeps
// the instance warm, so the limit holds against exactly the traffic it exists to stop.

const RATE_LIMIT = 30;                     // calls per IP per hour
const WINDOW_MS = 60 * 60 * 1000;          // 1 hour
const MAX_TOKENS_CAP = 2000;               // server-side ceiling regardless of what's requested
const MAX_BODY_BYTES = 50_000;             // ~50KB request body cap

const hits = new Map(); // ip -> [timestamps]

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= RATE_LIMIT) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  // keep the map from growing unbounded
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

export default async (req, context) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "Server is missing ANTHROPIC_API_KEY" }, 500);

  const ip =
    context?.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (rateLimited(ip)) {
    console.log(`RATE_LIMITED ip=${ip}`);
    return json(
      { error: "Too many requests. Take a breath — try again in a bit." },
      429
    );
  }

  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);

    const { messages, max_tokens } = JSON.parse(raw);
    if (!Array.isArray(messages) || messages.length === 0)
      return json({ error: "messages is required" }, 400);

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: Math.min(max_tokens || 1000, MAX_TOKENS_CAP),
        messages,
      }),
    });

    const data = await upstream.json();
    return json(data, upstream.status);
  } catch (err) {
    return json({ error: "Upstream request failed" }, 500);
  }
};
