import { supabase, supabaseReady } from "./supabaseClient";

// Session logger (Phase 3, step 3). Every coaching call gets written to the
// `sessions` table for legal protection + abuse tracking. Never throws — a
// failed log must not interrupt a manager mid-coaching-session. No-ops
// quietly if Supabase isn't configured (local dev without keys) or there's
// no signed-in user. Returns the new row's id (or null) so the caller can
// attach a report to this exact session if the manager flags it later.
export async function logSession({ userId, tool, input, output, model }) {
  if (!supabaseReady || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("sessions")
      .insert({ user_id: userId, tool, input, output, model })
      .select("id")
      .single();
    if (error) {
      console.error("Session log failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("Session log failed:", e.message);
    return null;
  }
}

// In-app "report a problem" flag (Phase 3, step 5). Lets a manager flag a
// specific coaching result as wrong, offensive, or concerning. Ties back to
// the exact session row when we have one, so review isn't guessing which
// output someone meant.
// Returns { ok, error } instead of a bare boolean. The old shape gave the caller
// no way to tell the user WHY a report didn't send, and FeedbackRow's `if (ok)`
// meant a failure did literally nothing on screen: the box stayed open, the
// button un-greyed, and the person assumed it went. A flagging mechanism that
// can fail invisibly is not a flagging mechanism, which is the whole point of
// Guideline 4.7.
export async function reportProblem({ userId, sessionId, reason }) {
  if (!supabaseReady) return { ok: false, error: "Not connected. Check your connection and try again." };
  if (!userId) return { ok: false, error: "You need to be signed in to report a response." };
  try {
    const { error } = await supabase
      .from("reports")
      .insert({ user_id: userId, session_id: sessionId || null, reason });
    if (error) {
      console.error("Report failed:", error.message, error.code || "", error.details || "");
      return { ok: false, error: "Couldn't send that report. Email hello@otsowntheshift.com and we'll pick it up." };
    }
    return { ok: true, error: null };
  } catch (e) {
    console.error("Report failed:", e.message);
    return { ok: false, error: "Couldn't send that report. Email hello@otsowntheshift.com and we'll pick it up." };
  }
}

// Phase 3, step 9: lets the Home screen tie its suggested focus card to
// whatever the manager actually used last, instead of a generic rotation.
// Returns the tool id (e.g. "coach") of the most recent session, or null for
// a brand-new user with no history yet.
export async function getLastSessionTool(userId) {
  if (!supabaseReady || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("tool")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.tool;
  } catch (e) {
    return null;
  }
}

// Home "accountability layer": each one-shot tool already writes a concrete
// follow-up commitment into its own output JSON. Rather than synthesize a
// pattern across sessions (which invents a back-and-forth that one-shot tools
// never had), we just quote back what the last plan actually told the manager
// to do. No AI call, no made-up narrative — the plan's own words.
//
// Practice is deliberately excluded: it has a real transcript and gets its own
// synthesized pattern feedback inside the Practice tool, not here.
const FOLLOWUP_FIELD_BY_TOOL = {
  coach: "followUp",
  convo: "followUpPlan",
  document: "followUpDate",
  skill_will: "followUpInterval",
  pushback: "followUpQuestion",
};

// Skips anything already ticked off in the Follow-through tracker.
//
// BUG THIS FIXES (reported 12 Aug 2026): Home and the tracker are two separate
// readers of the same commitments, and only the tracker knew about the Done
// button. Tick a follow-up off, come back to Home, and the brief was still
// telling you to do the thing you just finished. Worse than cosmetic — the whole
// pitch of Home is that it is the accountability layer, and an accountability
// layer that doesn't notice you did the work teaches people to ignore it.
//
// `id` is now selected because it wasn't before, which is the whole reason the
// anti-join was impossible here. The limit went 5 -> 25 so that ticking off a
// few in a row doesn't blank the brief while older open commitments still exist.
//
// NOTE: pushback appears in FOLLOWUP_FIELD_BY_TOOL but NOT in the tracker's
// COMMITMENT_FIELD — its followUpQuestion is a question to ask mid-conversation,
// not a dated task. So a pushback nudge on Home has no Done button anywhere and
// will persist until a newer session outranks it. That's intended, not a leak of
// this bug.
export async function getLastFollowUp(userId) {
  if (!supabaseReady || !userId) return null;
  try {
    const [{ data, error }, { data: doneRows }] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, tool, output")
        .eq("user_id", userId)
        .neq("tool", "practice")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase.from("followups_done").select("session_id").eq("user_id", userId),
    ]);
    if (error || !data) return null;
    const done = new Set((doneRows || []).map((r) => r.session_id));
    for (const row of data) {
      if (done.has(row.id)) continue;
      const field = FOLLOWUP_FIELD_BY_TOOL[row.tool];
      if (!field) continue;
      const out = row.output;
      if (!out || typeof out !== "object") continue;
      const text = typeof out[field] === "string" ? out[field].trim() : "";
      if (text) return { tool: row.tool, text };
    }
    return null;
  } catch (e) {
    return null;
  }
}
