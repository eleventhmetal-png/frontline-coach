import { createClient } from "@supabase/supabase-js";

// Frontline Coach — creates a Stripe Checkout Session (Full Page mode) so a
// signed-in user can subscribe to Standard (monthly or annual). Mirrors the
// auth pattern in claude.mjs: requires a valid Supabase session, no
// anonymous access, no arbitrary price IDs accepted from the client.
//
// IMPORTANT: the Founding price ($7.99/mo, capped at 30) is deliberately NOT
// in ALLOWED_PRICES. If it were, any signed-in user could call this endpoint
// directly (bypassing whatever the UI shows them) and lock in the founding
// rate for themselves. Founding checkout links are generated privately,
// per-user, via a separate admin-side script -- see Phase 8 of the beta
// launch plan. Do not add the founding price here when that gets built.
//
// Required env vars (Netlify, or a local .env for sandbox testing):
//   STRIPE_SECRET_KEY        - a sandbox secret key (sk_test_...) while
//                              testing locally; the real live key
//                              (sk_live_...) once deployed for real.
//   PRICE_STANDARD_MONTHLY   - Price ID for Standard/monthly. Defaults below
//   PRICE_STANDARD_ANNUAL    - Price ID for Standard/annual.   to the real,
//                              live-mode Price IDs -- override both in a
//                              local .env when testing against a sandbox,
//                              since sandbox and live Price IDs are different
//                              objects even for "the same" product. This way
//                              switching between sandbox testing and the real
//                              deploy is an env var change, never a code edit
//                              -- much harder to accidentally ship the wrong
//                              one.
//   PUBLIC_SITE_URL          - e.g. https://frontline-coach.com, used to
//                              build the success/cancel redirect URLs Stripe
//                              sends the browser back to after checkout.
//   SUPABASE_URL / VITE_SUPABASE_URL, SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY
//                              - same project as claude.mjs, used only to
//                              verify the caller's session token.

const ALLOWED_PRICES = new Set([
  process.env.PRICE_STANDARD_MONTHLY || "price_1TwvxRD4QXJZIZVeBajf5GLc", // Standard, $14.99/mo (live)
  process.env.PRICE_STANDARD_ANNUAL || "price_1Tww1DD4QXJZIZVewzWwwlaT", // Standard, $119/yr (live)
]);

export default async (req) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Server is missing STRIPE_SECRET_KEY" }, 500);

  // --- Auth gate: require a valid Supabase session, same as claude.mjs ---
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return json({ error: "Server auth not configured" }, 500);

  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) return json({ error: "Sign in required" }, 401);

  let user;
  try {
    const supa = createClient(supabaseUrl, anonKey);
    const { data, error } = await supa.auth.getUser(token); // verifies the JWT with Supabase
    if (error || !data?.user) return json({ error: "Invalid or expired session" }, 401);
    user = data.user;
  } catch (e) {
    return json({ error: "Auth check failed" }, 401);
  }

  let priceId;
  try {
    const body = await req.json();
    priceId = body?.priceId;
  } catch (e) {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!ALLOWED_PRICES.has(priceId)) {
    return json({ error: "Unknown or unavailable price" }, 400);
  }

  const siteUrl = process.env.PUBLIC_SITE_URL || "https://frontline-coach.com";

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  // The one field that links a completed Stripe checkout back to a specific
  // Frontline Coach account. The webhook (Phase 5) reads this to know whose
  // app_metadata.plan to flip to "paid". Nothing else ties the two together.
  params.set("client_reference_id", user.id);
  if (user.email) params.set("customer_email", user.email);
  params.set("success_url", `${siteUrl}/?checkout=success`);
  params.set("cancel_url", `${siteUrl}/?checkout=cancelled`);

  try {
    const upstream = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return json({ error: data.error?.message || "Stripe request failed" }, upstream.status);
    }
    return json({ url: data.url }, 200);
  } catch (err) {
    return json({ error: "Upstream request failed" }, 500);
  }
};
