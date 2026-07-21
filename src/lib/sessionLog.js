import { supabase, supabaseReady } from "./supabaseClient";

// Fire-and-forget session logger (Phase 3, step 3). Every coaching call gets
// written to the `sessions` table for legal protection + abuse tracking.
// Never throws and never blocks the UI — a failed log must not interrupt a
// manager mid-coaching-session. No-ops quietly if Supabase isn't configured
// (local dev without keys) or there's no signed-in user.
export function logSession({ userId, tool, input, output, model }) {
  if (!supabaseReady || !userId) return;
  supabase
    .from("sessions")
    .insert({ user_id: userId, tool, input, output, model })
    .then(({ error }) => {
      if (error) console.error("Session log failed:", error.message);
    });
}
