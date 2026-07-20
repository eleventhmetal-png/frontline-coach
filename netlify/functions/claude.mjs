export default async (req) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "Server is missing ANTHROPIC_API_KEY" }, 500);

  try {
    const { messages, max_tokens, model, system, temperature, stream } = await req.json();
    if (!Array.isArray(messages)) return json({ error: "messages is required" }, 400);

    const upstreamBody = {
      model: model || "claude-sonnet-5",
      max_tokens: max_tokens || 1000,
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
