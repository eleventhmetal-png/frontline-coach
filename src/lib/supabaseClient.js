import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Loud in dev, silent-safe in prod build — AuthGate checks `supabaseReady`
  // and shows a setup message instead of a blank white screen.
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Auth will not work until these are set."
  );
}

export const supabaseReady = Boolean(url && anonKey);

export const supabase = supabaseReady
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE is required by exchangeCodeForSession() in src/native/googleAuth.js.
        // On implicit the deep link returns tokens in the URL fragment instead of a
        // ?code, the exchange finds nothing, and native sign-in hangs with no error.
        flowType: "pkce",
      },
    })
  : null;
