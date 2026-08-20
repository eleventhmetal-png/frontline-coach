// =====================================================
// NATIVE INIT — one entry point, called once at boot
// =====================================================
// WIRED IN as of 19 Aug 2026 — src/main.jsx calls initNative() at boot. Before that
// this file was deliberately unreferenced so the web build worked without
// @capacitor/* installed; now the plugins are a hard requirement of both builds.
//
// Safe to call on the web — isNative() is false there and it returns having done
// nothing, so no plugin code runs and no plugin chunk is even fetched.

import { isNative, platform } from "./platform";
// Static, not dynamic. Both of these are already in the main bundle — App.jsx imports
// voice.js and AuthGate.jsx imports oauthDriver.js — so importing them lazily here
// bought nothing and made Vite warn on every build that the dynamic import cannot
// move them into a separate chunk. The plugin-backed modules below stay dynamic,
// because those genuinely are native-only.
import { registerDictationDriver } from "../lib/voice";
import { registerOAuthDriver } from "../lib/oauthDriver";

export async function initNative() {
  if (!isNative()) return;

  // Dynamic imports so the Capacitor packages are only pulled in on a real device.
  // A web visitor never downloads plugin code that cannot run for them.
  const [
    { capacitorDictation, probeDictation },
    { attachOAuthDeepLink, signInWithGoogleNative },
  ] = await Promise.all([import("./dictation"), import("./googleAuth")]);

  // Deep link first. If the app was cold-started BY the OAuth redirect, the
  // appUrlOpen event can arrive while boot is still in progress — attaching after
  // an await on anything slower means the event is missed and sign-in appears to
  // hang forever.
  try {
    await attachOAuthDeepLink();
    registerOAuthDriver({ signIn: signInWithGoogleNative });
  } catch (err) {
    // Do NOT register the driver if the listener failed to attach. A driver with no
    // deep-link handler opens the browser, the user signs in, and nothing ever comes
    // back — worse than falling through to the web path and failing loudly.
    console.error("Could not attach the OAuth deep-link handler:", err);
  }

  // Dictation second. Only register the native driver if the recognizer is really
  // there — registering it unconditionally would replace a working web driver with
  // a dead one on any platform where the plugin is missing.
  try {
    const ok = await probeDictation();
    if (ok) registerDictationDriver(capacitorDictation);
    else console.warn(`Speech recognition unavailable on ${platform()} — keeping the web driver.`);
  } catch (err) {
    console.error("Could not set up native dictation:", err);
  }
}
