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

// Tools that capture an employee name in their input, and therefore contribute to
// that person's history.
//
// 'prep' was missing until 28 July and the omission made 1:1 Prep write-only: it
// logged a session nobody ever read, so prepping for Mary twice produced "first
// time prepping for Mary" on the second run and she never appeared in the Recent
// chips. The compounding loop — the entire reason the tool exists — was broken by
// a filter in a different file.
//
// Anything added here must be handled in summarizeEmployeeHistory below.
const NAMED_TOOLS = ["convo", "prep"];

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
      .in("tool", NAMED_TOOLS)
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
      .select("tool, input, output, created_at")
      .eq("user_id", userId)
      .in("tool", NAMED_TOOLS)
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
      // A 1:1 and a planned conversation are different events and the model has to
      // be able to tell them apart — "we had a one-on-one" reads very differently
      // from "I corrected you." Their fields don't line up either, so each shape is
      // read on its own terms rather than through one generic mapping.
      const isPrep = s.tool === "prep";
      const type = isPrep ? "1:1" : inp.type || "conversation";
      // `text()` instead of a bare .trim(). The old form was
      // `(isPrep ? inp.note : inp.situation || "").trim()`, and `?:` binds looser
      // than `||` — so the `|| ""` fallback only ever protected the NON-prep
      // branch. A prep row missing `input.note`, `output.landOn` or
      // `output.afterwards` (exactly what a truncated prep writes) threw
      // "Cannot read properties of undefined (reading 'trim')". Nothing in the
      // call chain catches it, so the 1:1 Prep button spun forever — its
      // finally/setLoading(false) never ran — and it failed the same way every
      // time for that employee. Only reachable since 'prep' joined NAMED_TOOLS
      // on 28 July. Also coerces non-strings: a stored object would otherwise
      // reach the prompt as "[object Object]".
      const text = (v) => (typeof v === "string" ? v : "").trim();
      const situation = text(isPrep ? inp.note : inp.situation);
      const agreed = text(isPrep ? out.landOn : out.agreement || out.agreedAction);
      const followUp = text(isPrep ? out.afterwards : out.followUpPlan);
      // Most of these fields already end in a period, so appending one produced
      // "Friday.." throughout the history block. Cosmetic in isolation, but this
      // string is prompt input — sloppy punctuation is what the model imitates.
      const end = (t) => t.replace(/\s*\.*\s*$/, "") + ".";
      let line = `- ${when} (${type})`;
      if (situation) line += `: ${end(situation)}`;
      if (agreed) line += ` Agreed: ${end(agreed)}`;
      if (followUp) line += isPrep ? ` Next step: ${end(followUp)}` : ` Follow-up plan was: ${end(followUp)}`;
      // The read carries forward — it's the one field that lets a later prep say
      // "you've thought this about them twice now."
      if (isPrep && text(out.readOnThem)) line += ` Your read then: ${text(out.readOnThem)}`;
      return line;
    })
    .join("\n");
}
