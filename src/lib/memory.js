import { supabase, supabaseReady } from "./supabaseClient";

// Phase 3, step 6: reads the latest synthesized takeaway written by the
// nightly memory-synthesis background job (netlify/functions/synthesize-memory.mjs).
// The client only ever reads this table — writes require the Supabase
// service-role key, which never ships to the browser, so a manager can't
// spoof their own memory row even if they poke at the API directly.
export async function getLatestMemory(userId) {
  if (!supabaseReady || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("memory")
      .select("summary")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.summary || null;
  } catch (e) {
    return null;
  }
}
