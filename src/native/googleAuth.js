// =====================================================
// GOOGLE SIGN-IN ON NATIVE — system browser + deep link
// =====================================================
// WHY THE WEB PATH DOES NOT WORK HERE: Google refuses OAuth inside embedded
// webviews and returns disallowed_useragent. So supabase.auth.signInWithOAuth(),
// which navigates the current window, cannot work in a Capacitor container. It is
// not a Supabase problem and no Supabase setting fixes it.
//
// THE FLOW:
//   1. Ask Supabase for the authorize URL but do NOT navigate — skipBrowserRedirect.
//   2. Open that URL in the real Safari/Chrome via @capacitor/browser, where Google
//      is happy and the user may already have a session.
//   3. Google redirects to our custom scheme, the OS hands the app the deep link,
//      and appUrlOpen fires.
//   4. Exchange the ?code for a session, close the browser.
//
// PKCE, NOT IMPLICIT. exchangeCodeForSession() below requires the client to be on
// the PKCE flow so the verifier is waiting in storage. src/lib/supabaseClient.js
// does not set flowType, and the default differs across supabase-js versions —
// pin it to "pkce" there before trusting this on device. If it silently lands on
// implicit, the deep link arrives with tokens in the URL FRAGMENT instead of a
// ?code, exchangeCodeForSession finds nothing, and sign-in hangs with no error.
//
// THREE PLACES THIS BREAKS IF ONE IS MISSING, all of them silent:
//   - Supabase → Authentication → URL Configuration → Redirect URLs must list
//     REDIRECT_URL below, or Supabase drops the redirect and returns to Site URL.
//   - iOS: CFBundleURLSchemes in Info.plist must contain the scheme.
//   - Android: an intent-filter for the scheme in AndroidManifest.xml.

import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { supabase } from "../lib/supabaseClient";

// Must match the scheme registered in Info.plist and AndroidManifest.xml, and be
// listed in Supabase's Redirect URLs. Keep the three in sync.
export const OAUTH_SCHEME = "frontlinecoach";
export const REDIRECT_URL = `${OAUTH_SCHEME}://auth-callback`;

let listening = false;

// Attach the deep-link handler once at boot, not per sign-in attempt. If the user
// taps Google twice you would otherwise get two listeners, two exchanges for one
// code, and the second fails — which surfaces as a spurious error on a sign-in
// that actually succeeded.
export async function attachOAuthDeepLink() {
  if (listening) return;
  listening = true;

  await App.addListener("appUrlOpen", async ({ url }) => {
    if (!url || !url.startsWith(`${OAUTH_SCHEME}://`)) return;
    try {
      const parsed = new URL(url);
      const code = parsed.searchParams.get("code");
      const errorDescription = parsed.searchParams.get("error_description");

      if (errorDescription) {
        console.error("OAuth returned an error:", errorDescription);
        return;
      }
      if (!code) {
        // Almost always the implicit-vs-PKCE mismatch described above.
        console.error("Deep link had no ?code — is the Supabase client on flowType pkce?");
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) console.error("Code exchange failed:", error.message);
      // No navigation needed. onAuthStateChange in AuthGate picks the session up.
    } finally {
      // Close the system browser either way, or the user is left staring at a
      // blank Safari tab wondering whether it worked.
      try {
        await Browser.close();
      } catch (e) {
        /* already closed, or Android returned to the app on its own */
      }
    }
  });
}

// Returns nothing on success — the session arrives via the deep link, not here.
// Throws so the caller can show its normal error state.
export async function signInWithGoogleNative() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No authorize URL came back from Supabase.");
  await Browser.open({ url: data.url, presentationStyle: "popover" });
}
