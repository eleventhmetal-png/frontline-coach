// =====================================================
// LOCK ZOOM — native shell only
// =====================================================
// A native app shell must never scale. Reported 21 Aug 2026: an accidental pinch
// left the whole app zoomed in and panned — header under the status bar, left edge
// cut off, tab labels clipped to "OME". Pinching back out did NOT recover it. Only
// a force-quit did, because WKWebView holds its zoom scale on the scroll view and
// nothing in the page resets it.
//
// That makes it worse than an annoyance. There is no way for a user to get out of
// the broken state without knowing to kill the app, and a reviewer who triggers it
// by accident files it as a Guideline 2.1 bug against a build that is otherwise fine.
//
// TWO LAYERS, because neither is sufficient alone:
//   1. maximum-scale=1, user-scalable=no on the viewport meta. Applied to the store
//      binary only, by scripts/store-clean.mjs. WKWebView honours this (Mobile
//      Safari deliberately ignores it, which is why the web build is unaffected and
//      keeps pinch-zoom for low-vision users).
//   2. This file. The meta tag is declarative and a stale or mis-cached document
//      silently loses it; these listeners fail loudly or not at all. They also cover
//      the case where the webview is ALREADY scaled when the JS runs.
//
// iOS system-wide Accessibility Zoom is untouched and is the correct mechanism for
// a user who needs magnification in a native app.

export function lockZoom() {
  if (typeof document === "undefined") return;

  // WebKit's pinch gesture events. Non-passive or preventDefault() is ignored —
  // the listener runs, nothing happens, and it looks like the fix simply failed.
  const swallow = (e) => e.preventDefault();
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(type, swallow, { passive: false });
  }

  // Fallback for the same gesture arriving as raw multi-touch. Single-finger
  // scrolling is untouched, so the only thing this blocks is pinch.
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );
}
