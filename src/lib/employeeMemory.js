import { supabase, supabaseReady } from "./supabaseClient";

// Per-employee conversation memory for the Conversation Builder.
//
// Unlike src/lib/memory.js (manager-pattern memory synthesized nightly from
// Practice reps), this reads the manager's OWN prior Conversation Builder
// sessions for a specific employee and hands the next prep a short "since last
// time" block. Everything here is scoped to the signed-in manager's user_id, so
// a manager only ever sees the conversations they logged themselves.
//
// Deliberately kept light: we recall the most recent one or two conversations,
// not a permanent growing dossier. The employee name lives in the session input
// the Conversation Builder already logs, so no schema change is needed.

const norm = (s) => (s || "").trim().toLowerCase();

const nameOf = (row) =>
  row && row.input && typeof row.input === "object" ? row.input.name || "" : "";

// Distinct employees this manager has built conversations for, most recent
// first. Powers the "Recent" quick-pick chips.
export async function getCoachedEmployees(userId, limit = 8) {
  if (!supabaseReady || !userId) return [];
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("input, created_at")
      .eq("user_id", userId)
      .eq("tool", "convo")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error || !data) return [];
    const seen = new Set();
    const out = [];
    for (const row of data) {
      const name = nameOf(row).trim();
      const key = norm(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

// The most recent prior conversations for one employee (default last 2).
export async function getEmployeeHistory(userId, employeeName, max = 2) {
  if (!supabaseReady || !userId || !norm(employeeName)) return [];
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("input, output, created_at")
      .eq("user_id", userId)
      .eq("tool", "convo")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error || !data) return [];
    const target = norm(employeeName);
    return data.filter((row) => norm(nameOf(row)) === target).slice(0, max);
  } catch {
    return [];
  }
}

// Turn matched prior sessions into a compact block for the prompt. Built
// client-side from stored fields, no model call. Pulls only what a follow-up
// needs: when, what it was about, what was agreed, and the follow-up plan.
export function summarizeEmployeeHistory(sessions) {
  if (!sessions || !sessions.length) return "";
  return sessions
    .map((s) => {
      const inp = s.input && typeof s.input === "object" ? s.input : {};
      const out = s.output && typeof s.output === "object" ? s.output : {};
      const when = s.created_at
        ? new Date(s.created_at).toLocaleDateString()
        : "a prior date";
      const type = inp.type || "conversation";
      const situation = (inp.situation || "").trim();
      const agreed = (out.agreement || out.agreedAction || "").trim();
      const followUp = (out.followUpPlan || "").trim();
      let line = `- ${when} (${type})`;
      if (situation) line += `: ${situation}`;
      if (agreed) line += ` Agreed: ${agreed}.`;
      if (followUp) line += ` Follow-up plan was: ${followUp}.`;
      return line;
    })
    .join("\n");
}
