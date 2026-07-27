import { supabase, supabaseReady } from "./supabaseClient";

// Client-side read of the usage meter. Read-only by design: the "usage: read own"
// RLS policy grants SELECT and nothing else, so the browser can display the
// number but can't move it. All writes come from the proxy with the service role.
//
// Pure config and math live in ./credits.js, which is also imported by
// netlify/functions/claude.mjs — keeping the Supabase dependency out of that file
// so the function bundle stays small.

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

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
      .eq("day", todayUtc())
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
