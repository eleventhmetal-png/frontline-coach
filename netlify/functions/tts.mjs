import { corsPreflight, withCors } from "./_cors.mjs";
import { createClient } from "@supabase/supabase-js";
// Shared enforcement date — see src/lib/plans.js. Same cross-directory import as
// claude.mjs uses for credits.js; netlify.toml pins esbuild so functions can follow it.
import { enforcementActive } from "../../src/lib/plans.js";

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
// marin and cedar are the two OpenAI's own docs single out: "for best quality,
// we recommend using marin or cedar." They are the only two Practice actually
// assigns — the older eleven are kept allowed so a saved/queued call with an old
// voice name still plays instead of erroring, but nothing picks them.
const ALLOWED_VOICES = new Set([
  "marin", "cedar",
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse",
]);
const DEFAULT_VOICE = "cedar";

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

const handler = async (req) => {
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

  let user = null;
  try {
    const supa = createClient(supabaseUrl, anonKey);
    const { data, error } = await supa.auth.getUser(token); // verifies the JWT with Supabase
    if (error || !data?.user) return json({ error: "Invalid or expired session" }, 401);
    user = data.user;
  } catch (e) {
    return json({ error: "Auth check failed" }, 401);
  }

  // Read from app_metadata, which only the service role can write, so a user cannot
  // grant themselves a tier by editing local state. Same normalisation as claude.mjs
  // and planFromSession() in src/lib/usage.js.
  const claimedPlan = user?.app_metadata?.plan;
  const plan = claimedPlan === "premium" ? "premium" : claimedPlan === "paid" ? "paid" : "free";

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

  // =====================================================
  // VOICE ALLOWANCE — the real gate. Guideline: a client-side label is decoration.
  // =====================================================
  // Decided 1 Sep 2026. Premium only, with a one-time taste for the free tier so
  // people hear what they'd be buying; Standard gets none, matching PLAN_LIMITS in
  // src/lib/credits.js, and that includes founding members because Founding buys
  // Standard.
  //
  // ENFORCEMENT IS DATED, NOT IMMEDIATE. Read-aloud has been open to everyone all
  // through the beta, and switching it off mid-session for the people who have been
  // testing it is how you lose the few users who actually come back. Same
  // label-now/enforce-later approach as the Premium tools, and the same date. Metering
  // runs from today either way, so there is real data before anything gets refused.
  // Override with VOICE_ENFORCE_FROM to test enforcement early.
  // Date moved from 15 November to 1 October on 2 Sep 2026, and now comes from
  // src/lib/plans.js so the voice cutoff and the Premium tool gate cannot end up on
  // different days. They push toward the same plan; two dates would mean two separate
  // moments of taking something away.
  // VOICE_ENFORCE_FROM still overrides, for testing this one in isolation.
  const enforcing = process.env.VOICE_ENFORCE_FROM
    ? Date.now() >= new Date(process.env.VOICE_ENFORCE_FROM).getTime()
    : enforcementActive();

  // premium: 120 min/month, per the pricing on the $24.99 tier.
  // free: 20 minutes ONCE, ever. Not monthly — a repeating free allowance on a feature
  // that costs $0.06–0.10/min is a subscription we would be paying for. Twenty minutes
  // is roughly $1.20–2.00 per free user, one time, and it is enough for two or three
  // full roleplays rather than a single teaser — which is the point: the upgrade
  // decision should come after someone has actually used the thing.
  // paid: nothing, deliberately.
  const MONTHLY_LIMIT = { premium: 120 * 60, paid: 0, free: 0 };
  const LIFETIME_LIMIT = { premium: null, paid: 0, free: 20 * 60 };

  // Rough seconds from characters. Speech runs about 14 characters a second at a
  // natural pace, which is close enough for a budget — we are metering cost, not
  // billing to the millisecond, and the alternative is decoding the mp3 we just paid
  // for. Always at least a second so a two-word clip is never free.
  const estimatedSecs = Math.max(1, Math.ceil(text.length / 14));

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let admin = null;
  if (serviceKey) admin = createClient(supabaseUrl, serviceKey);

  if (admin) {
    try {
      const { data: usage } = await admin.rpc("voice_usage", { p_user_id: user.id });
      const row = Array.isArray(usage) ? usage[0] : usage;
      const monthSecs = row?.month_secs ?? 0;
      const lifetimeSecs = row?.lifetime_secs ?? 0;

      const monthCap = MONTHLY_LIMIT[plan];
      const lifetimeCap = LIFETIME_LIMIT[plan];
      const overMonth = typeof monthCap === "number" && monthCap > 0 && monthSecs >= monthCap;
      const overLifetime = typeof lifetimeCap === "number" && lifetimeSecs >= lifetimeCap;
      const noAllowance = monthCap === 0 && lifetimeCap === 0; // Standard

      if (enforcing && (noAllowance || overMonth || overLifetime)) {
        // 402, not 403: this is a payment boundary, and it lets the client tell it
        // apart from an auth failure. voice.js falls back to the device voice on any
        // error, so the reply is still spoken — just not in the good voice.
        return json(
          {
            error: "voice-not-included",
            plan,
            userMessage:
              plan === "premium"
                ? "You've used this month's read-aloud minutes. They reset at the start of next month."
                : "Read-aloud is part of Premium. Your device voice will keep reading replies.",
          },
          402
        );
      }
    } catch (e) {
      // FAIL OPEN on a metering error, deliberately, and the opposite of the consent
      // gate's fail-closed. Nothing private leaks if a clip is served unmetered; a
      // database hiccup silently muting a paying Premium customer mid-roleplay is the
      // worse outcome. The cost of being wrong here is cents.
    }
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

    // Record AFTER OpenAI actually returned audio. A failed synthesis must not spend
    // anyone's allowance, which is why this sits here and not next to the check above.
    // Fire-and-forget: the clip is already paid for and already in hand, so a metering
    // write that fails must not turn a working reply into an error. Under-counting by
    // one clip is cheaper than a broken roleplay.
    if (admin) {
      admin
        .rpc("consume_voice", { p_user_id: user.id, p_secs: estimatedSecs })
        .then(({ error }) => {
          if (error) console.warn(`consume_voice failed: ${error.message}`);
        })
        .catch(() => { /* ignore */ });
    }

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

// CORS wrapper. Every response path — including the streaming one — goes through
// withCors, so nothing can return uncovered. See ./_cors.mjs for why this exists.
export default async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  return withCors(req, await handler(req));
};
