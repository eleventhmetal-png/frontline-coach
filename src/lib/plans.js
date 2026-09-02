// =====================================================
// PLAN CONSTANTS — one source for client and server
// =====================================================
// Imported by BOTH src/App.jsx (browser) and netlify/functions/claude.mjs (Node), the
// same way src/lib/credits.js already is. netlify.toml pins the esbuild bundler
// specifically so functions can follow relative imports out of the functions directory —
// see the comment there before changing that setting.
//
// It exists because the alternative is a date written down in four places. When Ben moved
// Premium enforcement from 15 November to 1 October, the old arrangement would have meant
// editing App.jsx, claude.mjs, tts.mjs and the pricing copy and hoping none was missed.
// A drifted date here does not throw — it silently charges the wrong people or refuses the
// right ones, which is the worst class of bug this codebase has.
//
// NO DEPENDENCIES in this file, deliberately. It gets imported into a serverless function
// where every import costs cold-start time.

// The two tools that become Premium. Ids match the tab ids in App.jsx's NAV/tools list,
// which is what the client sends as the tool identifier on each AI call.
export const PREMIUM_TOOLS = new Set(["prep", "followups"]);

// ---------------------------------------------------------------------------
// ENFORCEMENT DATE — 1 October 2026, 05:00 UTC (midnight US Central)
// ---------------------------------------------------------------------------
// Moved from 15 November on 2 Sep 2026. Both the Premium tool gate and the read-aloud
// voice allowance turn on at this moment.
//
// WHY A DATE AT ALL, rather than gating immediately: 1:1 Prep, Follow-through and the
// practice voice have been open to everyone since launch. Switching them off with no
// notice punishes exactly the users who stuck around, and the app has been telling people
// in writing that the change is coming. The date is the promise.
//
// WHY BOTH THINGS SHARE ONE DATE: they both push a user toward the same Premium plan. Two
// dates would mean two separate moments of taking something away, and a second chance to
// get the copy wrong.
//
// TIME ZONE: 05:00 UTC is midnight Central, so the change lands overnight in Ben's own
// timezone rather than mid-shift for his users.
//
// Override with PREMIUM_ENFORCE_FROM (server) to test enforcement before the date. There
// is no client override on purpose: a user who could set the date could postpone it.
export const ENFORCE_FROM_ISO = "2026-10-01T05:00:00Z";

export function enforcementActive(now = new Date()) {
  const override =
    typeof process !== "undefined" && process.env && process.env.PREMIUM_ENFORCE_FROM;
  const from = new Date(override || ENFORCE_FROM_ISO);
  // A malformed override must not silently disable the gate — fall back to the constant.
  const when = Number.isFinite(from.getTime()) ? from : new Date(ENFORCE_FROM_ISO);
  return now.getTime() >= when.getTime();
}

// Human-readable, for copy. One place, so the sentence in the app and the sentence on the
// pricing page cannot disagree with the code that enforces it.
export const ENFORCE_FROM_LABEL = "1 October";

// Does this plan get the Premium tools? Before the date, everyone does.
export function canUsePremiumTools(plan, now = new Date()) {
  if (!enforcementActive(now)) return true;
  return plan === "premium";
}
