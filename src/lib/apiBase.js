// =====================================================
// API BASE — where /api/* actually lives
// =====================================================
// WHY THIS EXISTS: every backend call in the app is a relative path (/api/claude,
// /api/tts, /api/delete-account, /api/create-checkout-session). On the web that
// works because netlify.toml redirects /api/* to /.netlify/functions/*, and the
// app and the functions share an origin.
//
// A Capacitor build has no such origin. iOS serves the bundle from
// capacitor://localhost and Android from https://localhost, so a fetch to
// "/api/claude" resolves against the BUNDLE, finds nothing, and every AI call in
// the app fails with its generic catch message. Practice says "No reply came back."
// Nothing about this is obvious from testing in a browser — it only breaks on device.
//
// So the native build needs an absolute base pointing at the deployed functions.
//
//   web build   → "" → "/api/claude" (unchanged, netlify.toml handles it)
//   store build → "https://frontline-coach.com" → absolute URL
//
// Set VITE_API_BASE for the store build. It falls back to the production site so a
// forgotten env var degrades to "correct" rather than "silently broken", which is
// the failure mode that matters here — a store binary that can't reach its own
// backend passes every local check and fails on a reviewer's phone.

import { IS_STORE_BUILD } from "../storeBuild";

const FALLBACK = "https://frontline-coach.com";

export const API_BASE = IS_STORE_BUILD
  ? (import.meta.env.VITE_API_BASE || FALLBACK).replace(/\/$/, "")
  : "";

// Takes a root-relative path and returns whatever this build should actually call.
// Pass the same "/api/..." string the web build uses; this is a no-op on the web.
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
