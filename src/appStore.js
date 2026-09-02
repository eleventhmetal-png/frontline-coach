// =====================================================
// APP STORE LISTING — single source of truth
// =====================================================
// Read by three consumers, which is why it lives in its own module with no
// dependencies of its own:
//   - AuthGate.jsx, for the download badge on the web landing page (browser bundle)
//   - src/pageContent.js → scripts/gen-pages.mjs, for the static pages (Node)
//   - scripts/gen-index-jsonld.mjs is NOT a thing; index.html is hand-maintained, so
//     its JSON-LD carries the URL literally. If you change APP_STORE_ID, change it
//     there too — grep for "apps.apple.com".
//
// It cannot live in pageContent.js: that file reads process.env, so importing it into
// the browser bundle would break the web build.
//
// TO ACTIVATE: paste the numeric Apple ID from App Store Connect (App Information →
// General Information → Apple ID, ten digits). Everything downstream stays hidden
// while this is empty, so a half-finished release never ships a badge pointing at a
// 404. Fill it in AFTER you tap Release and the listing is live — a link to an
// approved-but-unreleased app 404s.
//
// US-ONLY LISTING. The /us/ segment is deliberate. If availability ever expands past
// the United States, drop it and Apple will redirect each visitor to their own
// storefront.
// Read from App Store Connect 2 Sep 2026 (App Information → Apple ID). Verified
// against the "View on App Store" link there:
// https://apps.apple.com/us/app/frontline-coach/id6803339678
//
// ORDER OF OPERATIONS: this link 404s until the version is actually RELEASED. It is
// approved but Pending Developer Release as of writing, so release first, then deploy
// the site — not the other way round.
export const APP_STORE_ID = "6803339678";

export const APP_STORE_URL = APP_STORE_ID
  ? `https://apps.apple.com/us/app/frontline-coach/id${APP_STORE_ID}`
  : "";

// True on an iPhone or iPad in a BROWSER — the audience for a download badge.
//
// Two things it deliberately gets right:
//   - iPadOS 13+ reports itself as Macintosh. The maxTouchPoints check is the standard
//     way to catch it; a UA test alone silently misses every iPad.
//   - It returns false inside the native app. There, the badge would invite someone to
//     download the app they are already using, and Guideline 3.1.1 has opinions about
//     an app linking out to the store. AuthGate's landing page is already behind
//     !IS_STORE_BUILD, so this is belt and braces, not the only guard.
export function isIOSBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iphone = /iPad|iPhone|iPod/.test(ua);
  const ipadOS = ua.includes("Macintosh") && (navigator.maxTouchPoints || 0) > 1;
  const inApp = typeof window !== "undefined" && !!window.Capacitor;
  return (iphone || ipadOS) && !inApp;
}
