import { createClient } from "@supabase/supabase-js";

// =====================================================
// TTS PROXY — OpenAI speech, key held server-side
// =====================================================
// WHY OPENAI AND NOT THE BROWSER: the platform's own speech synthesis caps out
// at "clearly synthetic" — on macOS and iOS the only usable en-US voice is
// Samantha, and a defensive employee who sounds like a GPS unit isn't a rep,
// it's a joke. Practice sells realistic delivery, so the voice has to be real.
//
// WHY OPENAI AND NOT GOOGLE: WaveNet is marginally cheaper, but Google means a
// GCP project and a service-account JSON credential. One bearer token next to
// ANTHROPIC_API_KEY is worth more than the rounding-error saving.
//
// COST SHAPE: gpt-4o-mini-tts runs roughly $0.015 per minute of audio. A
// roleplay turn is 150-250 characters, so a six-turn rep is about a cent.
//
// Same auth posture as claude.mjs: no anonymous access. Without the JWT gate
// this is an open proxy to a paid API on our key.

const TTS_MODEL = "gpt-4o-mini-tts";

// Only the voices Practice actually assigns. Blocks a caller from probing the
// API surface through our key.
const ALLOWED_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse",
]);
const DEFAULT_VOICE = "ash";

// A roleplay turn is capped at 350 output tokens upstream, which lands around
// 250 characters. 800 is generous headroom and still bounds what a single call
// can cost if somebody starts pasting.
const MAX_INPUT_CHARS = 800;

// Delivery direction is capped separately — it's ours, not the user's, but the
// client sends it so a bad client can't make it unbounded.
const MAX_INSTRUCTION_CHARS = 400;

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 522, 524, 529]);
const MAX_ATTEMPTS = 2;          // audio is a nice-to-have; the browser voice is the fallback
const ATTEMPT_TIMEOUT_MS = 15000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchSpeech(body, key) {
  let lastErr = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ATTEMPT_TIMEOUT_MS);
    let res = null;
    try {
      res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
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
    if (attempt === MAX_ATTEMPTS - 1) {
      if (res) return res;
      throw lastErr || new Error("tts upstream unavailable");
    }
    await sleep(400);
  }
  throw lastErr || new Error("tts upstream unavailable");
}

export default async (req) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.OPENAI_API_KEY;
  // 501 rather than 500 on purpose: the client treats "not configured" as
  // "fall back to the browser voice quietly" instead of showing an error. The
  // app must stay fully usable before this key exists.
  if (!key) return json({ error: "TTS not configured", code: "TTS_UNAVAILABLE" }, 501);

  // --- Auth gate: require a valid Supabase session --------------------------
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return json({ error: "Server auth not configured" }, 500);

  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) return json({ error: "Sign in required" }, 401);

  try {
    const supa = createClient(supabaseUrl, anonKey);
    const { data, error } = await supa.auth.getUser(token); // verifies the JWT with Supabase
    if (error || !data?.user) return json({ error: "Invalid or expired session" }, 401);
  } catch (e) {
    return json({ error: "Auth check failed" }, 401);
  }

  let payload = null;
  try {
    payload = await req.json();
  } catch (e) {
    return json({ error: "Malformed request body" }, 400);
  }

  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (!text) return json({ error: "Nothing to speak" }, 400);
  if (text.length > MAX_INPUT_CHARS) {
    return json({ error: `Text too long (max ${MAX_INPUT_CHARS} characters)` }, 400);
  }

  const voice = ALLOWED_VOICES.has(payload?.voice) ? payload.voice : DEFAULT_VOICE;
  const instructions =
    typeof payload?.instructions === "string" && payload.instructions.trim()
      ? payload.instructions.trim().slice(0, MAX_INSTRUCTION_CHARS)
      : null;

  try {
    const res = await fetchSpeech(
      {
        model: TTS_MODEL,
        voice,
        input: text,
        response_format: "mp3",
        ...(instructions ? { instructions } : {}),
      },
      key
    );

    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 300);
      } catch (e) { /* ignore */ }
      console.warn(`openai tts ${res.status}: ${detail}`);
      // Pass the status through so the client can tell a rate limit from a
      // billing problem, but the client falls back to the browser voice either
      // way — audio never blocks the conversation.
      return json({ error: "Speech generation failed", status: res.status }, res.status >= 500 ? 502 : res.status);
    }

    const audio = await res.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        // Never cached: the reply is unique per turn, and an audio body in a
        // shared CDN cache is a privacy problem, not a performance win.
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("tts failed:", e);
    return json({ error: "Speech generation failed" }, 502);
  }
};
