import { supabase, supabaseReady } from "./supabaseClient";

// Follow-through tracker.
//
// Every one-shot tool already ends by telling the manager to check something on a
// date. Those commitments are written into the session output and, until now, never
// read back — the app tells you to follow up on Thursday and then forgets it said so.
// This surfaces them as a list you can tick off.
//
// Deliberately no AI call anywhere in here. The commitment is quoted verbatim from
// what the plan actually said, the same principle as getLastFollowUp() on Home:
// don't synthesize a narrative the manager never agreed to.

// Which field in each tool's output holds the commitment.
//
// pushback is EXCLUDED on purpose even though sessionLog.js maps it. Its
// `followUpQuestion` is a question to ask mid-conversation ("what's getting in your
// way?"), not an action with a date. Putting it in a to-do list would be a
// category error and would clutter the list with things that aren't tasks.
// A COMMITMENT NEVER CONTAINS A BLANK. GUARDRAILS deliberately tells the model to
// leave bracketed blanks like [DATE] for facts only the manager has, which is right
// for a write-up. It is wrong here: the timing of a follow-up is something the coach
// DECIDES. The model split the difference and produced "Check in after their next
// [TWO SHIFTS]" — the answer was already inside the brackets, shouting.
// That string went straight onto the Home screen. A visible placeholder in a store
// screenshot is App Store Guideline 2.1 (App Completeness), so this is not cosmetic.
//
// A real blank is a CATEGORY the manager fills in. A bracketed value is content the
// model chose and then wrapped for no reason. Unwrap the second kind, leave the
// first alone, and lowercase a shouted unwrap so it reads as prose.
const BLANK_LABELS = /^(date|dates|time|times|name|names|employee|employee name|manager|shift|location|department|policy|witness|amount|number|what was said|what they said|specific example|insert [\w\s]+|your [\w\s]+)$/i;
export function unbracketCommitment(text) {
  if (!text) return text;
  return String(text).replace(/\[([^\[\]]{1,60})\]/g, (whole, inner) => {
    const body = inner.trim();
    if (!body || BLANK_LABELS.test(body)) return whole;   // a genuine fill-in-the-blank
    // All caps means the model was shouting a value it had already chosen.
    return /^[A-Z0-9 ,.'/-]+$/.test(body) ? body.toLowerCase() : body;
  });
}

const COMMITMENT_FIELD = {
  coach: "followUp",
  convo: "followUpPlan",
  document: "followUpDate",
  skill_will: "followUpInterval",
  // 1:1 Prep's "landOn" is the commitment the manager went in to get. Without this
  // line a prep could tell you to land a commitment and then never ask whether you
  // did — and the next prep would surface nothing as open, which is the exact
  // failure the follow-through tracker exists to prevent.
  prep: "landOn",
};

const TOOL_LABEL = {
  coach: "Coach",
  convo: "Conversation Builder",
  document: "Documentation",
  skill_will: "Skill vs. Will",
  prep: "1:1",
};

// Employee name, where the tool captured one. Only Conversation Builder asks for
// it, so most rows won't have one — the UI has to cope with that rather than
// pretending every follow-up is about a named person.
const nameOf = (input) =>
  input && typeof input === "object" && typeof input.name === "string"
    ? input.name.trim()
    : "";

// A short description of what the conversation was about, for context in the list.
const aboutOf = (tool, input) => {
  if (!input) return "";
  if (typeof input === "string") return input.trim();
  if (typeof input !== "object") return "";
  return (input.situation || input.input || "").trim();
};

/**
 * Open follow-ups, newest first. "Open" = the session wrote a commitment and
 * there's no matching row in followups_done.
 *
 * Two queries rather than a join: PostgREST can express the anti-join, but the
 * syntax is fragile and this runs over at most a few hundred rows per user. Clarity
 * wins over cleverness at this size.
 */
export async function getOpenFollowUps(userId, limit = 25) {
  if (!supabaseReady || !userId) return [];
  try {
    const [{ data: rows, error }, { data: doneRows }] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, tool, input, output, created_at")
        .eq("user_id", userId)
        .in("tool", Object.keys(COMMITMENT_FIELD))
        .order("created_at", { ascending: false })
        .limit(120),
      supabase.from("followups_done").select("session_id").eq("user_id", userId),
    ]);
    if (error || !rows) return [];

    const done = new Set((doneRows || []).map((r) => r.session_id));
    const out = [];
    for (const row of rows) {
      if (done.has(row.id)) continue;
      const field = COMMITMENT_FIELD[row.tool];
      const text =
        row.output && typeof row.output === "object" && typeof row.output[field] === "string"
          ? unbracketCommitment(row.output[field].trim())
          : "";
      if (!text) continue;
      out.push({
        id: row.id,
        tool: row.tool,
        toolLabel: TOOL_LABEL[row.tool] || row.tool,
        text,
        name: nameOf(row.input),
        about: aboutOf(row.tool, row.input),
        createdAt: row.created_at,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

// Open commitments for one person. Powers the "since last time" block on the 1:1
// prep card — the loop that makes prep compound instead of just summarising: the
// card asks whether last time's commitment held, and ticking it feeds the next one.
export async function getOpenFollowUpsFor(userId, employeeName) {
  const name = (employeeName || "").trim().toLowerCase();
  if (!name) return [];
  const all = await getOpenFollowUps(userId, 99);
  return all.filter((f) => (f.name || "").trim().toLowerCase() === name);
}

// Count only — for the badge on Home. Same logic, no payload shaping.
export async function getOpenFollowUpCount(userId) {
  const list = await getOpenFollowUps(userId, 99);
  return list.length;
}

export async function markFollowUpDone(userId, sessionId) {
  if (!supabaseReady || !userId || !sessionId) return false;
  try {
    const { error } = await supabase
      .from("followups_done")
      .insert({ user_id: userId, session_id: sessionId });
    // 23505 = already marked done, which is a no-op rather than a failure.
    return !error || error.code === "23505";
  } catch {
    return false;
  }
}

export async function undoFollowUpDone(userId, sessionId) {
  if (!supabaseReady || !userId || !sessionId) return false;
  try {
    const { error } = await supabase
      .from("followups_done")
      .delete()
      .eq("user_id", userId)
      .eq("session_id", sessionId);
    return !error;
  } catch {
    return false;
  }
}

// "3 days ago" / "today". A commitment made two weeks ago reads very differently
// from one made this morning, and that difference is the whole value of the list.
export function ageLabel(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

// Past a fortnight an unactioned commitment isn't a to-do any more, it's a signal
// the manager let it go. The UI flags those rather than letting them blend in.
export function isStale(iso) {
  if (!iso) return false;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) >= 14;
}
