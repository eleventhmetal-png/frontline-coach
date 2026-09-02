import { corsPreflight, withCors } from "./_cors.mjs";
import { createClient } from "@supabase/supabase-js";

// Frontline Coach — creates a Stripe Checkout Session (Full Page mode) so a
// signed-in user can subscribe to Standard (monthly or annual). Mirrors the
// auth pattern in claude.mjs: requires a valid Supabase session, no
// anonymous access, no arbitrary price IDs accepted from the client.
//
// FOUNDING PRICE — the old comment here said it must never be in ALLOWED_PRICES,
// because any signed-in user could call this endpoint directly and lock in the
// founding rate for themselves. That reasoning was right, and it is why the offer
// was never purchasable. Superseded 1 Sep 2026, not abandoned: eligibility is now a
// fact stamped on the profile at signup (profiles.is_founding, first 100 external
// accounts) and checked below against the caller's own row. A client cannot assert
// it — lock_profile_role() reverts any browser write to that column, same as it does
// for the Stripe columns and trial_ends_at.
//
// So the guard moved from "this price does not exist" to "prove you are entitled".
// If you ever add another entitlement-gated price, gate it the same way. Never gate
// on something the client sends.
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

// =====================================================
// PRICE CATALOGUE — one table, because three things need to agree
// =====================================================
// Every price the app can sell, what plan it grants, and whether it needs an
// entitlement. The plan travels to Stripe as checkout metadata, so the webhook never
// has to guess which tier was bought — see stripe-webhook.mjs.
//
// Verified against the live Stripe account 1 Sep 2026. Override any of these with the
// matching env var when testing against a sandbox: sandbox and live price IDs are
// different objects even for "the same" product, so switching is an env change and
// never a code edit.
const PRICES = [
  {
    id: process.env.PRICE_STANDARD_MONTHLY || "price_1TwvxRD4QXJZIZVeBajf5GLc",
    plan: "paid",
    label: "Standard monthly, $14.99",
  },
  {
    id: process.env.PRICE_STANDARD_ANNUAL || "price_1Tww1DD4QXJZIZVewzWwwlaT",
    plan: "paid",
    label: "Standard annual, $119",
  },
  {
    id: process.env.PRICE_FOUNDING_MONTHLY || "price_1TwvyTD4QXJZIZVeyDEHr5Io",
    plan: "paid",
    label: "Founding monthly, $7.99",
    // PLAN IS "paid" — CONFIRMED BY BEN 1 SEP 2026: "$7.99 should get standard access
    // not premium. we need to keep the guardrails to limit usage of premium features."
    // So a founding member gets Standard, not Premium: no 1:1 Prep, no Follow-through,
    // and the paid credit ceiling. Fair use at $7.99 was raised and accepted — "100 ppl
    // using more than they pay for is paid for by those paying more."
    //
    // The only entitlement-gated price. See the founding gate below and the note at the
    // top of this file.
    requires: "founding",
  },
  {
    id: process.env.PRICE_PREMIUM_MONTHLY || "price_1Ty1whD4QXJZIZVePbkwyUC8",
    plan: "premium",
    label: "Premium monthly, $24.99",
  },
  {
    id: process.env.PRICE_PREMIUM_ANNUAL || "price_1Ty1whD4QXJZIZVedKsdtVsZ",
    plan: "premium",
    label: "Premium annual, $199",
  },
];

const PRICE_BY_ID = new Map(PRICES.map((p) => [p.id, p]));

const handler = async (req) => {
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

  const price = PRICE_BY_ID.get(priceId);
  if (!price) {
    return json({ error: "Unknown or unavailable price" }, 400);
  }

  // --- Founding gate: first 100 to PURCHASE ---
  // Two conditions, both required:
  //   1. This account has not already claimed a slot. A cancelled founder keeps their
  //      claim and loses the rate, which is what the pricing page promises — "cancel
  //      and the rate goes with you, you'd rejoin at $14.99." Checking the claim rather
  //      than is_founding is what makes that true.
  //   2. Slots remain. founding_status() is a security-definer aggregate, so this needs
  //      no service-role key: the caller's own token is enough, and nothing about other
  //      users' rows is exposed.
  //
  // The claim itself is written by the webhook AFTER payment succeeds, never here.
  // Creating a checkout session is not a purchase — abandoning one must not burn a slot.
  if (price.requires === "founding") {
    try {
      const supaAsUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: profile, error: profileError } = await supaAsUser
        .from("profiles")
        .select("founding_slot_claimed_at")
        .eq("id", user.id)
        .maybeSingle();
      // Fail CLOSED on any lookup error. A database hiccup must not hand out a rate
      // that is locked for life.
      if (profileError) {
        return json({ error: "Could not verify your account" }, 403);
      }
      if (profile?.founding_slot_claimed_at) {
        return json({ error: "This account has already used its founding rate." }, 403);
      }

      const { data: status, error: statusError } = await supaAsUser.rpc("founding_status");
      const remaining = Array.isArray(status) ? status[0]?.remaining : status?.remaining;
      if (statusError || typeof remaining !== "number") {
        return json({ error: "Could not check founding availability" }, 403);
      }
      if (remaining <= 0) {
        return json({ error: "The founding rate is fully claimed." }, 409);
      }
    } catch (e) {
      return json({ error: "Could not verify your account" }, 403);
    }
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
  // WHICH TIER WAS BOUGHT, carried to the webhook explicitly.
  // checkout.session.completed does NOT include line items unless you expand them, so
  // the webhook cannot see the price without a second API call. Stamping the plan here
  // makes it unambiguous. Set on the subscription too, so later events (renewals,
  // cancellations, recoveries) can read it without another lookup — those events carry
  // the subscription, never the checkout session.
  params.set("metadata[plan]", price.plan);
  params.set("subscription_data[metadata][plan]", price.plan);
  params.set("subscription_data[metadata][price_label]", price.label);
  // Marks a founding purchase so the webhook knows to claim the slot. Set on the
  // subscription as well, so a cancellation event can tell a founder's subscription
  // from anyone else's without a profiles lookup.
  if (price.requires === "founding") {
    params.set("metadata[founding]", "1");
    params.set("subscription_data[metadata][founding]", "1");
  }
  params.set("success_url", `${siteUrl}/?checkout=success`);
  params.set("cancel_url", `${siteUrl}/?checkout=cancelled`);

  // =====================================================
  // STRIPE-SIDE FREE TRIAL — OFF BY DEFAULT, AND READ THIS BEFORE TURNING IT ON
  // =====================================================
  // Set STRIPE_TRIAL_DAYS to a positive integer and Stripe collects a card but does
  // not charge it for that many days.
  //
  // IT IS OFF BECAUSE THE USER HAS ALREADY HAD A FREE TRIAL BY THIS POINT. The app
  // grants 7 days at signup with no card at all (trial_ends_at in handle_new_user),
  // and this endpoint is only reachable AFTER that ran out. Setting this to 7 gives
  // 14 free days, not 7, and contradicts the pricing page — which promises "seven
  // days free with no card up front, then $14.99." Two trials stacked is almost
  // always an accident, so it has to be a deliberate env var rather than a default.
  //
  // Turn it on only if the model changes to card-up-front, and if you do that, drop
  // trial_days in handle_new_user to 0 in the same change so there is exactly one
  // trial in the system.
  //
  // Setting it here also OVERRIDES the trial configured on the product in the Stripe
  // dashboard — which is worth doing regardless: as of 1 Sep 2026 that dashboard
  // trial on Frontline Coach Standard is labelled "7-Day Free Trial" but its duration
  // is set to ONE MONTH. Code beats dashboard config because code is reviewable and
  // versioned; a mislabelled dashboard setting is invisible until it bills someone.
  const trialDays = parseInt(process.env.STRIPE_TRIAL_DAYS || "0", 10);
  if (Number.isFinite(trialDays) && trialDays > 0) {
    params.set("subscription_data[trial_period_days]", String(trialDays));
    // Without this, a trial that ends with no valid payment method leaves the
    // subscription hanging in a state the webhook does not handle. Cancel is the
    // honest outcome: no card, no access, no surprise charge attempt later.
    params.set("subscription_data[trial_settings][end_behavior][missing_payment_method]", "cancel");
    params.set("payment_method_collection", "if_required");
  }

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

// CORS wrapper. Every response path — including the streaming one — goes through
// withCors, so nothing can return uncovered. See ./_cors.mjs for why this exists.
export default async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  return withCors(req, await handler(req));
};
