// =====================================================
// CORS for the native app
// =====================================================
// WHY THIS SUDDENLY MATTERS: on the web the app and these functions share an
// origin, so the browser never ran a CORS check and no function ever needed a
// header. A Capacitor build serves the app from capacitor://localhost (iOS) or
// https://localhost (Android) and calls https://frontline-coach.com/api/*, which
// is cross-origin. Without these headers WKWebView blocks the response and the
// app shows its generic catch message — on Coach that reads "Couldn't generate a
// plan. Add a bit more detail and try again", which blames the user's input for a
// network failure and sends you looking in completely the wrong place.
//
// Every one of these calls sends Authorization and Content-Type: application/json,
// which are non-simple headers, so the browser fires an OPTIONS preflight first.
// Nothing handled OPTIONS either — so the request died before the real POST.
//
// ALLOWLIST, NOT "*". These endpoints are authenticated and metered per user;
// Access-Control-Allow-Origin: * on a credentialed endpoint invites anyone's page
// to spend a signed-in user's credits from their browser.

const ALLOWED = new Set([
  "capacitor://localhost", // iOS native
  "https://localhost", // Android native
  "http://localhost", // Android older / some webviews
  "https://frontline-coach.com", // web, same-origin but harmless to list
  "https://www.frontline-coach.com",
]);

// Vite dev server, and Xcode's live-reload origins.
const ALLOWED_PATTERNS = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];

function isAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED.has(origin)) return true;
  return ALLOWED_PATTERNS.some((re) => re.test(origin));
}

export function corsHeaders(req) {
  const origin = req.headers.get("origin");
  if (!isAllowed(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    // Without Vary, a CDN can cache the response for one origin and serve it to
    // another, which fails in a way that looks intermittent and random.
    Vary: "Origin",
  };
}

// Returns a response for an OPTIONS preflight, or null to carry on.
export function corsPreflight(req) {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

// Re-emits a response with the CORS headers added.
//
// Passing res.body through rather than reading it keeps STREAMING intact — the
// Coach and Practice tools stream tokens as they arrive, and buffering the body
// here would silently turn a live stream into a long pause and then a wall of
// text.
export function withCors(req, res) {
  const extra = corsHeaders(req);
  if (!Object.keys(extra).length) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
