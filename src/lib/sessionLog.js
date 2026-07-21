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
export async function reportProblem({ userId, sessionId, reason }) {
  if (!supabaseReady || !userId) return false;
  try {
    const { error } = await supabase
      .from("reports")
      .insert({ user_id: userId, session_id: sessionId || null, reason });
    if (error) {
      console.error("Report failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Report failed:", e.message);
    return false;
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

export async function getLastFollowUp(userId) {
  if (!supabaseReady || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("tool, output")
      .eq("user_id", userId)
      .neq("tool", "practice")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error || !data) return null;
    for (const row of data) {
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
