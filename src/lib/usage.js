import { supabase, supabaseReady } from "./supabaseClient";
import { usageDay } from "./credits";
import { apiUrl } from "./apiBase";

// Client-side read of the usage meter. Read-only by design: the "usage: read own"
// RLS policy grants SELECT and nothing else, so the browser can display the
// number but can't move it. All writes come from the proxy with the service role.
//
// Pure config and math live in ./credits.js, which is also imported by
// netlify/functions/claude.mjs — keeping the Supabase dependency out of that file
// so the function bundle stays small.

// Deliberately NOT the UTC date. The usage day rolls at 5am Central, so between
// 7pm Central and UTC midnight the UTC date is already tomorrow while the proxy
// is still writing to today's row — the pill would read an empty row and show a
// full meter. usageDay() is the shared definition; the SQL mirrors it exactly.

// Points used today. Returns 0 when there's no row yet (a user who hasn't run
// anything), and null when we genuinely couldn't read it — the caller uses null
// to hide the meter rather than display a wrong number.
export async function getPointsUsedToday(userId) {
  if (!supabaseReady || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("usage_daily")
      .select("points")
      .eq("user_id", userId)
      .eq("day", usageDay())
      .maybeSingle();
    if (error) return null;
    return data?.points ?? 0;
  } catch {
    return null;
  }
}

// The plan the proxy will enforce. Read from app_metadata, which only the
// service role can write — a user can't grant themselves a tier by editing
// local state. Mirrors the normalisation in claude.mjs.
export function planFromSession(session) {
  const claimed = session?.user?.app_metadata?.plan;
  return claimed === "premium" ? "premium" : claimed === "paid" ? "paid" : "free";
}

// ── Trial ───────────────────────────────────────────────────────────────────
// Whole days left before profiles.trial_ends_at. Display only — the real gate is
// in netlify/functions/claude.mjs, because a client-side check is a suggestion
// rather than a wall. Returns null when there's no trial set or we can't read it,
// and the UI hides the countdown rather than guessing.
export async function getTrialDaysLeft(userId) {
  if (!supabaseReady || !userId) return null;
  try {
    const { data, error } = await supabase.rpc("trial_days_left");
    if (error || data == null) return null;
    return Number(data);
  } catch {
    return null;
  }
}

// Kicks off Stripe Checkout. The function validates the price against its own
// allowlist, so a tampered priceId is rejected server-side rather than trusted.
export async function startCheckout(priceId) {
  try {
    const { data } = (await supabase?.auth?.getSession?.()) ?? { data: null };
    const token = data?.session?.access_token;
    const res = await fetch(apiUrl("/api/create-checkout-session"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(priceId ? { priceId } : {}),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.url) return { error: body?.error || "Couldn't start checkout." };
    window.location.href = body.url;
    return {};
  } catch (e) {
    return { error: "Couldn't reach checkout. Try again." };
  }
}

// Moves an EXISTING subscriber to a Premium price in place, rather than opening a second
// checkout — see netlify/functions/upgrade-subscription.mjs for why that distinction is
// the whole point of a separate endpoint.
//
// Returns { ok } on success, { error } for anything the caller should show, and
// { needsCheckout: true } when the server says there is no subscription to upgrade. That
// last case is not an error: it is somebody on a free trial pressing an upgrade button,
// and the right answer is to send them to normal checkout.
export async function startUpgrade(priceId) {
  try {
    const { data } = (await supabase?.auth?.getSession?.()) ?? { data: null };
    const token = data?.session?.access_token;
    const res = await fetch(apiUrl("/api/upgrade-subscription"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ priceId }),
    });
    const body = await res.json().catch(() => null);
    if (res.status === 409 && body?.code === "NO_SUBSCRIPTION") {
      return { needsCheckout: true };
    }
    if (!res.ok) return { error: body?.error || "Couldn't change your plan." };

    // The webhook, not this response, is what flips app_metadata.plan — so the new tier
    // is not in the local session yet. Refresh it so the UI unlocks without a reload.
    // Stripe fires the event within a second or two, but it is not instant, so a failure
    // here is not an error worth showing: the plan lands on the next refresh either way.
    try { await supabase.auth.refreshSession(); } catch (e) { /* ignore */ }
    return { ok: true, alreadyOnPlan: !!body?.alreadyOnPlan };
  } catch (e) {
    return { error: "Couldn't reach the server. Try again." };
  }
}

// ── Usage summary: what you've DONE, not what you have left ─────────────────
// The meter counts up rather than down, deliberately. A depleting allowance reads
// as rationing — every action costs you something. An accumulating one reads as
// evidence, and it's the exact input the paywall needs: Ben's July 25 spec says
// fire the upgrade prompt right after a win ("you built 4 plans and ran 2 role
// plays this week"), never a cold "trial expired." This is that number.
//
// Rolling 30 days rather than calendar month, so somebody opening the app on the
// 2nd doesn't see a summary of nothing.

// Tools grouped by what the manager would call the output, not by internal id.
// pushback and skill_will are quick hits rather than artefacts, so they roll into
// the total without getting their own headline.
const BUCKET = {
  coach: "plans",
  convo: "plans",
  prep: "plans",
  practice: "roleplays",
  document: "records",
  pushback: "quick",
  skill_will: "quick",
};

export async function getUsageSummary(userId, days = 30) {
  if (!supabaseReady || !userId) return null;
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase
      .from("sessions")
      .select("tool, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      // Ordered. Without it PostgREST returned an ARBITRARY 500-row subset, so
      // `firstAt` was the minimum of a random slice — the card said "since 12
      // July" when the real answer was 28 June — and `total` silently capped at
      // 500 with no indication it had been truncated.
      .order("created_at", { ascending: true })
      .limit(500);
    if (error || !data) return null;

    const counts = { plans: 0, roleplays: 0, records: 0, quick: 0 };
    for (const row of data) {
      // hasOwn, not a bare lookup. `BUCKET["constructor"]` resolved up the
      // prototype chain to a truthy function, which then wrote a junk key with a
      // NaN value into `counts` — no throw, just a corrupted breakdown.
      if (!Object.prototype.hasOwnProperty.call(BUCKET, row.tool)) continue;
      counts[BUCKET[row.tool]] += 1;
    }
    const total = data.length;
    // First session in the window, so the card can say "since 28 June" rather
    // than an abstract "last 30 days" for somebody who only just joined.
    const firstAt = data.length
      ? data.reduce((a, r) => (r.created_at < a ? r.created_at : a), data[0].created_at)
      : null;
    return { ...counts, total, firstAt, days };
  } catch {
    return null;
  }
}
