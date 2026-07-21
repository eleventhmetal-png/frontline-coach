import { createClient } from "@supabase/supabase-js";

// Phase 3, step 6: nightly memory-synthesis job — PRACTICE ONLY.
//
// Practice (roleplay) is the one tool with a genuine multi-turn transcript, so
// it's the only place a real behavioral pattern can be synthesized honestly.
// This job reads a user's recent Practice reps (the roleplay dialogue + the
// debrief), asks Claude to name the patterns that show up ACROSS reps (e.g.
// "you concede early when the employee pushes on tone"), and writes one row per
// user into public.memory. The Practice tool reads the latest row back in and
// shows it before the next rep; Coach also gets it as background on how this
// manager tends to handle live conversations.
//
// One-shot tools (coach, pushback, convo, skill_will, document) are NOT
// synthesized here — they have no back-and-forth to synthesize. Their Home
// follow-up reminder just quotes the plan's own follow-up field client-side
// (see src/lib/sessionLog.js getLastFollowUp).
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

const MODEL_SYNTHESIS = "claude-sonnet-5"; // standing rule: app runs on current-gen Sonnet, not a pinned dated snapshot. Sonnet is plenty for this synthesis.
const MIN_NEW_PRACTICE_SESSIONS = 3; // need a few reps before a "pattern" is real, not a one-off
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
      .eq("tool", "practice")
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

    if (newSinceLastMemory.length < MIN_NEW_PRACTICE_SESSIONS) {
      results.skipped++;
      continue;
    }

    const toSummarize = userSessions.slice(0, MAX_SESSIONS_PER_USER);
    const transcript = toSummarize
      .map((s, i) => {
        const inp = s.input && typeof s.input === "object" ? s.input : {};
        const scenario = inp.scenario || "(scenario not recorded)";
        const dialogue = typeof inp.transcript === "string" ? inp.transcript : JSON.stringify(inp.transcript || "");
        const debrief = typeof s.output === "string" ? s.output : JSON.stringify(s.output || {});
        return `REP ${i + 1} — SCENARIO: ${scenario}\nDIALOGUE (MANAGER = the person you're coaching, EMPLOYEE = the roleplay bot):\n${dialogue}\nDEBRIEF SCORE: ${debrief}`;
      })
      .join("\n\n===== NEXT REP =====\n\n");

    const system = `You read a manager's recent Practice reps — roleplay conversations they ran against a simulated employee, each followed by a debrief score. These are REAL multi-turn conversations with actual back-and-forth, so you can and should reference how the manager handled the dialogue itself.

Your job: name the behavioral patterns that repeat ACROSS reps — the things this manager tends to do when a live conversation gets hard. Be concrete and honest, the way a district manager who watched all these reps would put it. Examples of the register: "you tend to concede the moment the employee pushes back on tone," "you ask a good opening question and then answer it yourself before they can," "you set a clear standard early but stop following up once the employee gets emotional." Only call something a pattern if it shows up in more than one rep — never build a pattern off a single exchange. If the reps show real improvement, say that specifically.

Write 3-5 sentences, plain prose, no headers or bullet points, addressed directly to the manager as "you." This is shown to them inside the Practice tool before their next rep, and fed to their coaching sessions as background on how they handle live conversations. Be specific about what they do and when it happens; don't hedge into generic advice.`;

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
