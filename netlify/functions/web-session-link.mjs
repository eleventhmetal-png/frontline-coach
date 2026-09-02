import { corsPreflight, withCors } from "./_cors.mjs";
import { createClient } from "@supabase/supabase-js";

// Frontline Coach — mints a one-time link that signs the CURRENT app user in on the web.
//
// THE PROBLEM IT SOLVES
// Guideline 3.1.1 forbids taking payment inside the app, so an iOS user has to buy on the
// web. But the Safari view the app opens has its own cookie jar — it knows nothing about
// the session in the app's webview. So the person who just tapped "Upgrade", having
// already decided to give us money, was met with a login form. That is the worst possible
// place to add friction, and "sign in again" is the reason a lot of link-out flows
// convert badly.
//
// This returns a Supabase magic link with redirect_to pointing at the app root plus
// ?subscribe=, so one tap goes: app → Safari → signed in → Stripe checkout. No password,
// no second sign-in.
//
// SECURITY, because this hands out a credential in a URL:
//   * The email is taken from the VERIFIED JWT, never from the request body. You can only
//     ever mint a link for yourself.
//   * Supabase magic links are single-use and expire (1 hour by default; shorten it in
//     Auth settings if you want). Once it is redeemed it is dead.
//   * It goes straight from this response into the system browser. It is never emailed,
//     logged by us, or rendered into a page.
//   * It is still a bearer token for the duration. If somebody screenshots the Safari
//     address bar and sends it to a stranger within the hour, that stranger gets in. That
//     is the same exposure as any emailed magic link, which is the mechanism this app
//     already uses for password resets.
//
// Required env: SUPABASE_SERVICE_ROLE_KEY (generateLink is an admin call),
// SUPABASE_URL / VITE_SUPABASE_URL, SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY,
// PUBLIC_SITE_URL (optional).

const ALLOWED_TIERS = new Set(["founding", "standard", "premium"]);

const handler = async (req) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://frontline-coach.com";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server not configured" }, 500);
  }

  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) return json({ error: "Sign in required" }, 401);

  let email;
  try {
    const supa = createClient(supabaseUrl, anonKey);
    const { data, error } = await supa.auth.getUser(token);
    if (error || !data?.user?.email) return json({ error: "Invalid or expired session" }, 401);
    email = data.user.email;
  } catch (e) {
    return json({ error: "Auth check failed" }, 401);
  }

  let tier = null;
  try {
    const body = await req.json();
    if (body?.subscribe && ALLOWED_TIERS.has(body.subscribe)) tier = body.subscribe;
  } catch (e) { /* body is optional */ }

  // Whitelisted values only — this is concatenated into a URL that we then hand to a
  // browser, and an unvalidated one would be an open redirect off our own domain.
  const redirectTo = tier ? `${siteUrl}/?subscribe=${tier}` : `${siteUrl}/`;

  try {
    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);

    const url = data?.properties?.action_link;
    if (!url) throw new Error("no action link returned");

    return json({ url }, 200);
  } catch (e) {
    // FAIL SOFT and say so. The client falls back to opening /subscribe normally, which
    // costs the user a sign-in but still sells them something. A hard error here would
    // turn a working purchase path into a dead button over a convenience feature.
    console.warn("web-session-link failed:", e.message || e);
    return json({ error: "Could not create a sign-in link", code: "LINK_UNAVAILABLE" }, 503);
  }
};

export default async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  return withCors(req, await handler(req));
};
