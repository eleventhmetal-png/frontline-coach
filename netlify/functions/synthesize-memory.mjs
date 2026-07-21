import { createClient } from "@supabase/supabase-js";

// Phase 3, step 6: nightly memory-synthesis job.
//
// Reads recent session activity per user, asks Claude to pull out durable
// coaching-relevant takeaways (recurring people/situations, patterns,
// what's actually sticking vs. not), and writes one row per user into
// public.memory. AICoach (and eventually the other tools) reads the latest
// row back in to tailor its plans instead of starting cold every time.
//
// Runs on Netlify's scheduler (see `config` export below) once a day. Can
// also be hit manually while testing — see the auth check below.
//
// Required env vars (set in Netlify, not in the client bundle):
//   SUPABASE_URL               - same project as VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  - Supabase "secret key" (sb_secret_...), NOT the publishable key.
//                                Needed because public.memory has no insert policy for
//                                regular users — only the service role can write here.
//   ANTHROPIC_API_KEY          - already set for the claude.mjs proxy function.
//   SYNTHESIS_JOB_SECRET       - any random string. Lets you trigger this manually
//                                for testing via header x-synthesis-key.

const MODEL_SYNTHESIS = "claude-opus-4-8"; // build-time: Opus for quality while we validate output. Switch to claude-sonnet-5 once the prompt is proven out and this is running daily for real users — cost adds up, Sonnet should be plenty for this once it's dialed in.
const MIN_NEW_SESSIONS = 3; // don't bother synthesizing over 1-2 stray sessions
const MAX_SESSIONS_PER_USER = 15; // cap how much we feed the model per user

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  // Netlify's own scheduler sets this header on scheduled invocations. Anything
  // else (a stray public hit on the URL) needs the manual test secret instead,
  // so this can't be used to spam the Anthropic API or spam-write memory rows.
  const isScheduled = req.headers.get("x-netlify-event") === "schedule";
  const manualKey = req.headers.get("x-synthesis-key");
  const expectedManualKey = process.env.SYNTHESIS_JOB_SECRET;
  if (!isScheduled && (!expectedManualKey || manualKey !== expectedManualKey)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  if (!anthropicKey) return json({ error: "Missing ANTHROPIC_API_KEY" }, 500);

  const db = createClient(supabaseUrl, serviceKey);

  // Pull recent sessions (7-day lookback covers a job that missed a day or two)
  // plus every user's existing latest memory row, then decide per-user in JS —
  // simplest thing that works at this scale, no need for a Postgres function yet.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: sessions, error: sessionsErr }, { data: memories, error: memErr }] = await Promise.all([
    db
      .from("sessions")
      .select("id, user_id, tool, input, output, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    db.from("memory").select("user_id, created_at").order("created_at", { ascending: false }),
  ]);
  if (sessionsErr) return json({ error: `sessions query failed: ${sessionsErr.message}` }, 500);
  if (memErr) return json({ error: `memory query failed: ${memErr.message}` }, 500);

  const lastMemoryByUser = new Map();
  for (const m of memories || []) {
    if (!lastMemoryByUser.has(m.user_id)) lastMemoryByUser.set(m.user_id, m.created_at);
  }

  const byUser = new Map();
  for (const s of sessions || []) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id).push(s);
  }

  const results = { processed: 0, skipped: 0, failed: 0, users: [] };

  for (const [userId, userSessions] of byUser.entries()) {
    const lastMemoryAt = lastMemoryByUser.get(userId);
    const newSinceLastMemory = lastMemoryAt
      ? userSessions.filter((s) => s.created_at > lastMemoryAt)
      : userSessions;

    if (newSinceLastMemory.length < MIN_NEW_SESSIONS) {
      results.skipped++;
      continue;
    }

    const toSummarize = userSessions.slice(0, MAX_SESSIONS_PER_USER);
    const transcript = toSummarize
      .map((s) => {
        const inputText = typeof s.input === "string" ? s.input : JSON.stringify(s.input);
        const outputText = typeof s.output === "string" ? s.output : JSON.stringify(s.output).slice(0, 600);
        return `[${s.tool}] INPUT: ${inputText}\nOUTPUT: ${outputText}`;
      })
      .join("\n\n---\n\n");

    const system = `You read a manager's recent coaching-app sessions and extract only what's genuinely useful to remember for next time — recurring situations or people across sessions, patterns in how they describe problems, what kind of coaching register they respond to. Skip anything that was a one-off.

Each session is a single situation submitted and a plan generated in response — there is no back-and-forth conversation inside a session. Never write as if a live negotiation or dialogue happened. Only describe patterns you can see ACROSS separate sessions (e.g. "you tend to describe problems in general terms before naming specifics" is fair; "you resisted being more specific" is not, unless the person literally revised their own input).

Write 3-5 sentences, plain prose, no headers or bullet points, addressed directly to the manager as "you" — this is shown to them as a reminder on their home screen, and also fed to their next coaching session as background context. Be specific (situations, roles, recurring issues) when the sessions give you specifics; stay general only when the sessions actually are general.`;

    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL_SYNTHESIS,
          max_tokens: 400,
          system,
          messages: [{ role: "user", content: transcript }],
        }),
      });
      if (!upstream.ok) throw new Error(`Anthropic ${upstream.status}`);
      const data = await upstream.json();
      const summary = data?.content?.[0]?.text?.trim();
      if (!summary) throw new Error("Empty synthesis result");

      const { error: insertErr } = await db.from("memory").insert({
        user_id: userId,
        summary,
        source_session_ids: toSummarize.map((s) => s.id),
      });
      if (insertErr) throw new Error(`insert failed: ${insertErr.message}`);

      results.processed++;
      results.users.push({ userId, sessionsUsed: toSummarize.length });
    } catch (e) {
      results.failed++;
      results.users.push({ userId, error: e.message });
    }
  }

  return json(results);
};

// Netlify scheduled function: runs once a day at 13:00 UTC (~8am/9am US
// depending on DST — doesn't need to be precise, this just needs to run
// sometime overnight so memory is fresh by the next morning's sessions).
export const config = {
  schedule: "0 13 * * *",
};
