// Frontline Coach — daily pulse.
//
// WHY THIS EXISTS: as of 2026-08-12 the beta had 0 second-day returns and 7 of
// 12 users who never opened it once. That was found by digging around in the
// dashboard. A number you have to go looking for is a number you stop looking
// for. This prints the five that matter in about two seconds.
//
// The only metric that decides anything right now is DAY-2 RETURN. Signups are
// vanity while the bucket leaks. Everything else here is context for that one
// line.
//
// TRUTH SOURCE: public.usage_daily, not public.sessions. sessions is written
// client-side by src/lib/sessionLog.js, so a dropped fetch or a closed tab
// means a real use never gets logged. usage_daily is written server-side by
// the claude.mjs proxy with the service role before every upstream call, so a
// row there means the user actually made the app do work. sessions is still
// read below, but only for the tool mix and as a cross-check: if sessions is
// far below usage_daily, client logging is broken and that's its own alert.
//
// RUN IT:
//   node scripts/pulse.mjs           # human-readable report
//   node scripts/pulse.mjs --json    # machine-readable, for piping somewhere
//   node scripts/pulse.mjs --quiet   # print only if something is wrong (cron mode)
//
// Exit code is 1 when any RED alert fires, so `--quiet` + cron gives you a
// report that stays silent until it shouldn't.
//
// Reads .env from the repo root. Needs SUPABASE_SERVICE_ROLE_KEY (already
// there for the Stripe/memory work) and VITE_SUPABASE_URL. The service role
// bypasses RLS, which is the whole point: no other key can see other users'
// rows. Never ship this to the browser.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARGS = new Set(process.argv.slice(2));
const AS_JSON = ARGS.has("--json");
const QUIET = ARGS.has("--quiet");

// ---------- config ----------
// Thresholds that decide whether this run is worth waking you up for.
const ALERT = {
  neverUsedShare: 0.4, // >40% of signups who never once used it
  dormantDays: 3, // no active user at all for this many days
};
const BETA_CAP = 30; // mirrors the cap in handle_new_user(); shown for context only

// ---------- env ----------
// No dotenv dependency in package.json and no reason to add one for this.
function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      // Real environment wins over .env, so CI/cron can override.
      if (!(key in env) || !env[key]) env[key] = val;
    }
  } catch {
    // No .env is fine as long as the vars are in the real environment.
  }
  return env;
}

// ---------- date helpers ----------
// usage_daily.day is a UTC date. Everything here stays in UTC so the cohort
// math lines up with what the proxy actually wrote. The header prints the
// local time separately so it's obvious which clock is which.
const DAY_MS = 86_400_000;
const utcDay = (d) => new Date(d).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
const shiftDay = (day, n) => utcDay(Date.parse(day) + n * DAY_MS);

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Both live in .env at the repo root. The service role key is the\n" +
        "sb_secret_... one from Supabase -> Project Settings -> API."
    );
    process.exit(2);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const today = utcDay(Date.now());

  // ---------- pull ----------
  // Tiny dataset (beta caps at 30 users), so pull it all and do the cohort math
  // in JS. If this ever gets big, move it into a SQL view and select from that.
  const [profilesRes, usageRes, sessionsRes, reportsRes] = await Promise.all([
    db.from("profiles").select("id, email, created_at, is_internal_pilot"),
    db.from("usage_daily").select("user_id, day, points").gt("points", 0).limit(10000),
    db.from("sessions").select("user_id, tool, created_at").limit(10000),
    db.from("reports").select("id, reason, created_at").eq("status", "open"),
  ]);

  for (const [name, res] of Object.entries({
    profiles: profilesRes,
    usage_daily: usageRes,
    sessions: sessionsRes,
    reports: reportsRes,
  })) {
    if (res.error) {
      console.error(`Query failed on ${name}: ${res.error.message}`);
      process.exit(2);
    }
  }

  const profiles = profilesRes.data ?? [];
  const usage = usageRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const openReports = reportsRes.data ?? [];

  // Internal CCW pilots are excluded from the funnel numbers for the same
  // reason they're excluded from the beta cap: they're not evidence of demand.
  // They're still counted separately so a "nobody used it" day is attributable.
  const external = profiles.filter((p) => !p.is_internal_pilot);
  const internal = profiles.filter((p) => p.is_internal_pilot);
  const emailOf = new Map(profiles.map((p) => [p.id, p.email || p.id.slice(0, 8)]));
  const isInternal = new Map(profiles.map((p) => [p.id, !!p.is_internal_pilot]));

  // ---------- active days per user ----------
  const activeDays = new Map(); // user_id -> Set(day)
  for (const row of usage) {
    if (!activeDays.has(row.user_id)) activeDays.set(row.user_id, new Set());
    activeDays.get(row.user_id).add(row.day);
  }
  const externalActive = [...activeDays.entries()].filter(
    ([id]) => isInternal.get(id) === false
  );

  // ---------- 1. day-2 return ----------
  // THE number. Cohort = every external user whose first active day was at
  // least one day ago (someone who first used it today hasn't had the chance
  // to come back yet, and counting them drags the rate down for no reason).
  // Returned = has any active day AFTER their first.
  //
  // Reported two ways on purpose:
  //   strict  - came back the very next calendar day
  //   ever    - came back on any later day
  // Strict is the honest activation signal. Ever is the ceiling. If ever is
  // also zero, the product isn't being adopted at all, it's being sampled.
  let cohort = 0;
  let returnedNextDay = 0;
  let returnedEver = 0;
  const oneAndDone = [];
  for (const [id, days] of externalActive) {
    const sorted = [...days].sort();
    const first = sorted[0];
    if (daysBetween(first, today) < 1) continue; // no chance to return yet
    cohort += 1;
    const laterDays = sorted.slice(1);
    if (laterDays.length > 0) returnedEver += 1;
    else oneAndDone.push({ email: emailOf.get(id), firstUsed: first });
    if (sorted.includes(shiftDay(first, 1))) returnedNextDay += 1;
  }
  const rate = (n) => (cohort === 0 ? null : n / cohort);

  // ---------- 2. never opened it ----------
  // Signed up, never made the app do a single thing. The 7-of-12 number.
  const neverUsed = external.filter((p) => !activeDays.has(p.id));
  const neverUsedShare = external.length === 0 ? 0 : neverUsed.length / external.length;

  // ---------- 3. recent activity ----------
  // Split external from internal everywhere. An internal pilot who opens the
  // app every morning would otherwise paper over a week in which no real user
  // touched it at all — which is exactly the blackout this is meant to catch.
  const externalUsage = usage.filter((r) => isInternal.get(r.user_id) === false);
  const internalUsage = usage.filter((r) => isInternal.get(r.user_id) === true);
  const activeOn = (rows, day) =>
    new Set(rows.filter((r) => r.day === day).map((r) => r.user_id));
  const activeToday = activeOn(externalUsage, today);
  const activeYesterday = activeOn(externalUsage, shiftDay(today, -1));
  const activeTodayInternal = activeOn(internalUsage, today);
  const active7d = new Set(
    externalUsage.filter((r) => daysBetween(r.day, today) <= 6).map((r) => r.user_id)
  );
  // How long since a REAL user touched it. A quiet week is the loudest signal here.
  const lastActiveDay = externalUsage.length
    ? [...externalUsage].sort((a, b) => (a.day < b.day ? 1 : -1))[0].day
    : null;
  const daysDark = lastActiveDay === null ? null : daysBetween(lastActiveDay, today);

  // ---------- 4. signups ----------
  const since = (iso, days) => Date.parse(iso) >= Date.now() - days * DAY_MS;
  const signups24h = external.filter((p) => since(p.created_at, 1));
  const signups7d = external.filter((p) => since(p.created_at, 7));

  // ---------- 5. tool mix + logging cross-check ----------
  const sessions7d = sessions.filter((s) => since(s.created_at, 7));
  const toolMix = {};
  for (const s of sessions7d) toolMix[s.tool] = (toolMix[s.tool] || 0) + 1;
  const practiceUsers7d = new Set(
    sessions7d.filter((s) => s.tool === "practice").map((s) => s.user_id)
  ).size;
  // usage_daily is one row per user per DAY; sessions is one row per CALL. So
  // sessions should always exceed active user-days by a healthy margin. If it
  // doesn't, client-side logging is dropping writes and the tool mix below is
  // lying to you.
  const activeUserDays7d = usage.filter((r) => daysBetween(r.day, today) <= 6).length;
  const loggingSuspect = sessions7d.length < activeUserDays7d;

  // ---------- alerts ----------
  const alerts = [];
  if (cohort > 0 && returnedEver === 0) {
    alerts.push({
      level: "RED",
      msg: `0 of ${cohort} users have EVER come back after their first day. The product is being sampled, not adopted.`,
    });
  } else if (cohort > 0 && returnedNextDay === 0) {
    alerts.push({
      level: "RED",
      msg: `0 of ${cohort} users returned the next day. ${returnedEver} came back eventually.`,
    });
  }
  if (external.length > 0 && neverUsedShare > ALERT.neverUsedShare) {
    alerts.push({
      level: "RED",
      msg: `${neverUsed.length} of ${external.length} signups (${pct(neverUsedShare)}) never used it once. The gap is between signup and first rep.`,
    });
  }
  if (external.length > 0 && lastActiveDay === null) {
    alerts.push({
      level: "RED",
      msg: `${external.length} signups and not one of them has ever used it. Nothing downstream matters until that changes.`,
    });
  } else if (daysDark !== null && daysDark >= ALERT.dormantDays) {
    alerts.push({
      level: "RED",
      msg:
        `No activity from a real user in ${daysDark} days (last was ${lastActiveDay}).` +
        (activeTodayInternal.size > 0 ? ` Internal pilots were active today — that doesn't count.` : ""),
    });
  }
  if (loggingSuspect) {
    alerts.push({
      level: "AMBER",
      msg: `sessions (${sessions7d.length}) is below active user-days (${activeUserDays7d}) over 7d. Client-side session logging is probably dropping writes — the tool mix below is unreliable.`,
    });
  }
  if (openReports.length > 0) {
    alerts.push({
      level: "AMBER",
      msg: `${openReports.length} open problem report${openReports.length === 1 ? "" : "s"}.`,
    });
  }
  const anyRed = alerts.some((a) => a.level === "RED");

  const payload = {
    generatedAt: new Date().toISOString(),
    utcDay: today,
    dayTwoReturn: {
      cohort,
      returnedNextDay,
      returnedEver,
      nextDayRate: rate(returnedNextDay),
      everRate: rate(returnedEver),
      oneAndDone,
    },
    activation: {
      externalSignups: external.length,
      internalPilots: internal.length,
      betaCap: BETA_CAP,
      neverUsed: neverUsed.length,
      neverUsedShare,
      neverUsedEmails: neverUsed.map((p) => p.email),
    },
    activity: {
      activeToday: activeToday.size,
      activeYesterday: activeYesterday.size,
      active7d: active7d.size,
      activeTodayInternal: activeTodayInternal.size,
      lastActiveDay,
      daysDark,
    },
    signups: { last24h: signups24h.length, last7d: signups7d.length },
    tools: { sessions7d: sessions7d.length, practiceUsers7d, toolMix, loggingSuspect },
    openReports: openReports.length,
    alerts,
  };

  if (AS_JSON) {
    console.log(JSON.stringify(payload, null, 2));
    process.exit(anyRed ? 1 : 0);
  }
  if (QUIET && alerts.length === 0) process.exit(0);

  render(payload);
  process.exit(anyRed ? 1 : 0);
}

// ---------- rendering ----------
function pct(n) {
  return n === null ? "n/a" : `${Math.round(n * 100)}%`;
}
function bar(n, total, width = 20) {
  if (!total) return "░".repeat(width);
  const filled = Math.round((n / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function render(p) {
  const local = new Date(p.generatedAt).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const line = "─".repeat(62);

  console.log(`\n${line}`);
  console.log(`  FRONTLINE COACH · PULSE`);
  console.log(`  ${local} CT   ·   UTC day ${p.utcDay}`);
  console.log(line);

  // The one that matters, first and biggest.
  const d = p.dayTwoReturn;
  console.log(`\n  DAY-2 RETURN`);
  if (d.cohort === 0) {
    console.log(`    No cohort yet. Nobody has had a first day long enough ago to count.`);
  } else {
    console.log(
      `    Next day      ${d.returnedNextDay}/${d.cohort}  ${bar(d.returnedNextDay, d.cohort)}  ${pct(d.nextDayRate)}`
    );
    console.log(
      `    Ever returned ${d.returnedEver}/${d.cohort}  ${bar(d.returnedEver, d.cohort)}  ${pct(d.everRate)}`
    );
    if (d.oneAndDone.length) {
      console.log(`\n    One and done (${d.oneAndDone.length}):`);
      for (const u of d.oneAndDone.slice(0, 10)) {
        console.log(`      ${u.email}  ·  first and only day ${u.firstUsed}`);
      }
      if (d.oneAndDone.length > 10) console.log(`      … and ${d.oneAndDone.length - 10} more`);
    }
  }

  const a = p.activation;
  console.log(`\n  ACTIVATION`);
  console.log(
    `    Signups       ${a.externalSignups} external / cap ${a.betaCap}   (+${a.internalPilots} internal pilots)`
  );
  console.log(
    `    Never used it ${a.neverUsed}/${a.externalSignups}  ${bar(a.neverUsed, a.externalSignups)}  ${pct(a.neverUsedShare)}`
  );
  if (a.neverUsedEmails.length) {
    console.log(`      ${a.neverUsedEmails.slice(0, 8).join(", ")}${a.neverUsedEmails.length > 8 ? ", …" : ""}`);
  }

  const t = p.activity;
  console.log(`\n  ACTIVITY  (real users only — internal pilots excluded)`);
  console.log(
    `    Active today      ${t.activeToday}${t.activeTodayInternal ? `   (+${t.activeTodayInternal} internal)` : ""}`
  );
  console.log(`    Active yesterday  ${t.activeYesterday}`);
  console.log(`    Active last 7d    ${t.active7d}`);
  console.log(
    `    Last activity     ${t.lastActiveDay ?? "never"}${t.daysDark ? `  (${t.daysDark} days ago)` : ""}`
  );
  console.log(`    New signups       ${p.signups.last24h} in 24h  ·  ${p.signups.last7d} in 7d`);

  const tl = p.tools;
  console.log(`\n  TOOL USE (7d, client-logged)`);
  if (tl.sessions7d === 0) {
    console.log(`    Nothing logged.`);
  } else {
    const entries = Object.entries(tl.toolMix).sort((x, y) => y[1] - x[1]);
    for (const [tool, n] of entries) {
      console.log(`    ${tool.padEnd(12)} ${String(n).padStart(4)}  ${bar(n, tl.sessions7d, 16)}`);
    }
    console.log(`    Practice users: ${tl.practiceUsers7d}`);
  }

  if (p.alerts.length) {
    console.log(`\n${line}`);
    for (const al of p.alerts) {
      console.log(`  [${al.level}] ${al.msg}`);
    }
  } else {
    console.log(`\n  No alerts.`);
  }
  console.log(`${line}\n`);
}

main().catch((err) => {
  console.error("pulse failed:", err?.message || err);
  process.exit(2);
});
