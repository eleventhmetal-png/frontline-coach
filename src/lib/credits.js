// Single source of truth for AI usage economics. Imported by BOTH the client
// (for the meter pill) and netlify/functions/claude.mjs (for enforcement), so
// the number a user sees and the number they're charged can never disagree.
//
// ── The unit ────────────────────────────────────────────────────────────────
// 1 point = $0.0025 of real compute. Free tier = 100 points/day = $0.25.
// Users only ever see points; dollars stay internal.
//
// ── Why cost is computed, not looked up per tool ────────────────────────────
// The proxy charges from (measured input size + max_tokens + the model's rates),
// not from a tool name the client sends. A client can lie about being "pushback"
// when it's really running a roleplay; it cannot lie about the payload it just
// sent or the model it asked for. Both of those actually determine the bill.
//
// ── Measured system-prompt sizes, July 2026 ─────────────────────────────────
// Coach 2,259 tok · Pushback 1,975 · Convo 1,827 · Skill/Will 1,204 ·
// Roleplay debrief 1,219 · Roleplay turn 1,011 · Documentation 874.
// There is NO prompt caching, so the full system prompt is billed every call —
// which is why roleplay (system resent each turn) dominates the cost model.

// Anthropic list prices, USD per million tokens (July 2026).
export const MODEL_RATES = {
  "claude-sonnet-5":            { in: 3, out: 15 },
  "claude-haiku-4-5-20251001":  { in: 1, out: 5 },
};

export const USD_PER_POINT = 0.0025;

// Daily point ceilings by plan.
//
// free  — 100 pts ≈ $0.25/day. A realistic day (2 roleplays + 3 coach sessions
//         + 4 quick actions) lands around 86, so the tier is genuinely usable.
//         That matters: the content pages convert into this tier, and a crippled
//         free tier makes seven pages of traffic worthless.
// paid  — Standard. Marketed as unlimited; this is the fair-use backstop so one
//         whale can't run $60/mo of compute on a $14.99 plan. 1,200 pts ≈ $3/day
//         is roughly 20x a heavy real day.
// premium — adds voice. Higher text ceiling plus a monthly voice allowance.
export const PLAN_LIMITS = {
  free:    { points: 100,  voiceSecsPerMonth: 0 },
  paid:    { points: 1200, voiceSecsPerMonth: 0 },
  premium: { points: 2400, voiceSecsPerMonth: 120 * 60 }, // 120 min/mo
};

// Voice is capped in MINUTES, not points, and monthly rather than daily.
// Realtime voice runs roughly $0.06–0.10/minute — a 10-minute roleplay is
// $0.60–1.00, an order of magnitude above any text action. At $24.99/mo an
// uncapped heavy voice user is loss-making, so "unlimited voice" is not an
// option we can honestly offer. 120 min/mo ≈ $7–12 of compute, which leaves
// margin at $24.99.
//
// NOT YET ENFORCED — no voice endpoint exists. The column and the number are
// here so the limit is decided before the feature ships, not after.
export const VOICE_USD_PER_MIN_EST = 0.08;

// Rough tokens-per-character. Anthropic's tokenizer averages ~3.5–4 chars/token
// for English prose; 4 is the conservative-enough divisor for budgeting.
const CHARS_PER_TOKEN = 4;

export function estimateInputTokens({ system, messages }) {
  let chars = typeof system === "string" ? system.length : 0;
  for (const m of messages || []) {
    if (typeof m?.content === "string") chars += m.content.length;
    else if (Array.isArray(m?.content)) {
      for (const b of m.content) if (typeof b?.text === "string") chars += b.text.length;
    }
  }
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

export function pointsForUsd(usd) {
  // Number.isFinite guard: Math.max(1, Math.ceil(NaN)) is NaN, not 1, and
  // JSON.stringify turns NaN into null — so a NaN cost reached consume_credits as
  // a null argument and shipped `X-Credits-Cost: NaN` to the browser.
  if (!Number.isFinite(usd)) return 1;
  return Math.max(1, Math.ceil(usd / USD_PER_POINT));
}

// ── Reserve, then reconcile ─────────────────────────────────────────────────
// The spend decision has to happen BEFORE the call, but the real cost isn't
// known until after. Charging max_tokens up front and leaving it there
// over-charges badly: a roleplay turn has a 350-token ceiling and typically
// uses ~50 of it, so a full session got billed ~50 points instead of ~24.
// Meanwhile a JSON tool with max_tokens 2500 lands around half of that. No
// single ratio fits both.
//
// So: reserve a conservative slice up front (enough to stop abuse and to make
// concurrent requests race safely), then true up against the actual
// output_tokens Anthropic reports. Over-reserve is refunded, under-reserve is
// topped up.
const RESERVE_OUTPUT_RATIO = 0.35;

export function reservePointsFor({ model, system, messages, max_tokens }) {
  const rate = MODEL_RATES[model] || MODEL_RATES["claude-sonnet-5"];
  const inTok = estimateInputTokens({ system, messages });
  const outTok = (Number(max_tokens) || 1000) * RESERVE_OUTPUT_RATIO;
  return pointsForUsd((inTok * rate.in + outTok * rate.out) / 1_000_000);
}

// True cost, from the usage block Anthropic returns. input_tokens is exact here
// rather than estimated from characters, so this supersedes the reserve on both
// dimensions.
export function actualPointsFor({ model, inputTokens, outputTokens }) {
  const rate = MODEL_RATES[model] || MODEL_RATES["claude-sonnet-5"];
  const usd = ((inputTokens || 0) * rate.in + (outputTokens || 0) * rate.out) / 1_000_000;
  return pointsForUsd(usd);
}

// ── User-facing translation ─────────────────────────────────────────────────
// What 100 points buys, for the "that's about X" line when the pill is tapped.
// Derived from the measured prompt sizes above; kept as constants so the copy
// doesn't need a live calculation.
export const REFERENCE_COSTS = {
  roleplaySession: 24, // ~10 exchanges on Sonnet, incl. the debrief
  coach:           10, // Sonnet, the reasoning-heavy hero tool
  convo:            3,
  pushback:         2,
  document:         2,
  diagnose:         2,
};

export function describeRemaining(points) {
  const rp = Math.floor(points / REFERENCE_COSTS.roleplaySession);
  const co = Math.floor(points / REFERENCE_COSTS.coach);
  if (points <= 0) return "You're out for today.";
  if (rp >= 1) return `About ${rp} more role play${rp === 1 ? "" : "s"}, or ${co} coaching sessions.`;
  if (co >= 1) return `About ${co} more coaching session${co === 1 ? "" : "s"}. Not enough for a role play.`;
  return "Enough for a quick pushback or a documentation clean-up.";
}

// The pill shows 0–100 regardless of plan so the scale means the same thing to
// everyone. A paid user on a 1,200-point ceiling still sees a familiar number.
export function pillValue(pointsUsed, plan = "free") {
  const limit = (PLAN_LIMITS[plan] || PLAN_LIMITS.free).points;
  const remaining = Math.max(0, limit - (pointsUsed || 0));
  return Math.round((remaining / limit) * 100);
}

export function remainingPoints(pointsUsed, plan = "free") {
  const limit = (PLAN_LIMITS[plan] || PLAN_LIMITS.free).points;
  return Math.max(0, limit - (pointsUsed || 0));
}

// ── The usage day ───────────────────────────────────────────────────────────
// Credits reset at 5am Central, not UTC midnight. UTC midnight lands at 7pm
// Central — mid-evening for a frontline supervisor, so somebody working a close
// got a reset partway through their shift. It also allowed a double-dip: spend
// 100 at 6pm, get a fresh 100 at 7pm, spend those before midnight.
//
// A named zone rather than a fixed -6 offset, so the boundary stays at 5am local
// through DST instead of drifting an hour twice a year.
//
// MUST match public.usage_day() in the SQL migration. If these disagree, the pill
// reads a different row than the proxy writes and silently shows a wrong number.
const RESET_TZ = "America/Chicago";
const RESET_HOUR = 5;

// Which usage day is it right now. Shift the instant back 5 hours, then render
// the date in Chicago — the same operation the SQL performs on Chicago wall-clock.
export function usageDay(now = new Date()) {
  const shifted = new Date(now.getTime() - RESET_HOUR * 3600 * 1000);
  // en-CA formats as YYYY-MM-DD, which is what the date column wants.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESET_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(shifted);
}

// Seconds until the next 5am Central, for the "resets in ~Xh" line. Derived from
// the current Chicago wall-clock so it's correct without date arithmetic across
// zones. On the two DST transition days this can be an hour out, which is
// immaterial for a rounded "about Xh" display.
export function secondsUntilReset(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RESET_TZ, hour12: false,
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  // Some runtimes render midnight as hour 24 under hour12:false.
  const secsNow = (get("hour") % 24) * 3600 + get("minute") * 60 + get("second");
  let delta = RESET_HOUR * 3600 - secsNow;
  if (delta <= 0) delta += 86400;
  return delta;
}
