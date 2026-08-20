// =====================================================
// GOOGLE SIGN-IN SEAM
// =====================================================
// Same idea as registerDictationDriver in ./voice.js, and for the same reason: the
// native implementation needs @capacitor/* imports, and AuthGate must not import
// those. Vite resolves dynamic imports at build time too, so even a lazy
// import("../native/googleAuth") inside a click handler would break `npm run build`
// on a machine that hasn't installed the plugins.
//
// This file has no dependencies at all. AuthGate calls signInWithGoogle(); on the
// web nothing is registered and it takes the default path. src/native/index.js
// registers the native path at boot on device.

let driver = null;

// driver: { signIn(): Promise<void> } — resolves once the browser has been handed
// off. The session arrives later, via the deep link, not from this promise.
export function registerOAuthDriver(d) {
  if (d && typeof d.signIn === "function") driver = d;
}

export function hasOAuthDriver() {
  return !!driver;
}

export function runOAuthDriver() {
  return driver.signIn();
}
