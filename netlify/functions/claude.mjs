// Netlify Function (v2). Holds the API key server-side; the browser never sees it.
// Reached at /api/claude via the redirect in netlify.toml.

export default async (req) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "Server is missing ANTHROPIC_API_KEY" }, 500);

  // Models the client is allowed to request. Anything else falls back to Sonnet.
  // Keeps a client-side edit from pointing spend at an arbitrary/expensive model.
  const DEFAULT_MODEL = "claude-sonnet-4-6";
  const ALLOWED_MODELS = new Set([
    "claude-sonnet-4-6",          // default — reasoning-heavy tools
    "claude-haiku-4-5-20251001",  // fast — short, live tools (pushback, roleplay turns)
  ]);

  try {
    const { messages, max_tokens, model, system, stream, temperature } = await req.json();
    if (!Array.isArray(messages)) return json({ error: "messages is required" }, 400);

    const chosenModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;

    const body = {
      model: chosenModel,
      // Client may request fewer; hard ceiling stays 3000 so nothing runs away
      // but the longer tools (Coach's 13-field plan) can finish their JSON.
      max_tokens: Math.min(Number(max_tokens) || 1000, 3000),
      messages,
    };

    // Optional sampling temperature. Anthropic accepts 0–1; clamp so a bad or
    // out-of-range client value can never break the call. Used to add variety to
    // the roleplay employee (openers, phrasing). Omitted -> Anthropic's default.
    if (typeof temperature === "number" && isFinite(temperature)) {
      body.temperature = Math.min(Math.max(temperature, 0), 1);
    }

    // Optional system prompt sent as a cached block. The VOICE/WORLD/schema spine
    // is large and identical on every call, so caching it cuts input reprocessing
    // and cost. Backward compatible: if no system is sent, behaves as before.
    if (typeof system === "string" && system.trim()) {
      body.system = [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
      ];
    }

    const headers = {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    };

    // Streaming path: pipe Anthropic's SSE straight back to the browser so the UI
    // can render words as they arrive. Only activates when the client asks for it,
    // so the JSON path above is untouched for anything that doesn't opt in.
    if (stream === true) {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...body, stream: true }),
      });
      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => "");
        return json({ error: "Upstream stream failed", detail: errText }, upstream.status || 500);
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return json(data, upstream.status);
  } catch (err) {
    return json({ error: "Upstream request failed" }, 500);
  }
};
