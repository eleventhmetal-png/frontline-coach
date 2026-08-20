// Is this actually running inside a Capacitor container right now?
//
// IS_STORE_BUILD (src/storeBuild.js) and this are different questions, and
// conflating them causes bugs in both directions:
//
//   IS_STORE_BUILD  — a BUILD-time flag. True for the bundle destined for the app
//                     stores. Also true when you run that bundle in a desktop
//                     browser to check it, where no native plugin exists.
//   isNative()      — a RUNTIME fact. True only on a real device or simulator
//                     with the Capacitor bridge attached.
//
// Register native drivers on isNative(), gate store COPY on IS_STORE_BUILD.

export function isNative() {
  if (typeof window === "undefined") return false;
  const cap = window.Capacitor;
  if (!cap) return false;
  // isNativePlatform() is the supported check; the older isNative property is kept
  // as a fallback so a plugin version bump can't silently turn this off.
  if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
  return !!cap.isNative;
}

export function platform() {
  if (typeof window === "undefined") return "web";
  return window.Capacitor?.getPlatform?.() || "web";
}
