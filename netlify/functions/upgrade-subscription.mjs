import { corsPreflight, withCors } from "./_cors.mjs";
import { createClient } from "@supabase/supabase-js";

// Frontline Coach — moves an EXISTING subscriber to a different price, in place.
//
// WHY THIS IS NOT JUST ANOTHER CHECKOUT SESSION
// create-checkout-session.mjs is for someone with no subscription. Pointing an existing
// subscriber at it creates a SECOND subscription: they get billed twice, Stripe sends two
// receipts, and the webhook overwrites stripe_subscription_id so the first one becomes
// invisible to us while still charging them. That is the single most expensive bug this
// endpoint exists to prevent.
//
// The correct move is to update the existing subscription's item to the new price and let
// Stripe prorate. The customer sees one subscription, one receipt, and a credit for the
// unused part of what they already paid.
//
// WHEN THIS MATTERS: 1 October 2026, when 1:1 Prep, Follow-through and read-aloud become
// Premium-only. Until now the only purchase surface in the app was the trial-expiry
// paywall, which means someone already paying $14.99 had NO WAY to give us more money.
// They would have lost three features with no route to keep them.
//
// Required env vars: STRIPE_SECRET_KEY, SUPABASE_URL / VITE_SUPABASE_URL,
// SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY.

// Prices this endpoint will move somebody TO. Deliberately only the two Premium prices:
// this is an upgrade path, not a general price-changer. Downgrades and cancellations go
// through Stripe's own portal from the receipt email, where the cancellation flow, the
// proration preview and the dunning rules are Stripe's problem rather than ours.
const UPGRADE_TARGETS = new Set([
  process.env.PRICE_PREMIUM_MONTHLY || "price_1Ty1whD4QXJZIZVePbkwyUC8", // $24.99/mo
  process.env.PRICE_PREMIUM_ANNUAL || "price_1Ty1whD4QXJZIZVedKsdtVsZ", // $199/yr
]);

const handler = async (req) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Server is missing STRIPE_SECRET_KEY" }, 500);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return json({ error: "Server auth not configured" }, 500);

  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) return json({ error: "Sign in required" }, 401);

  let user;
  try {
    const supa = createClient(supabaseUrl, anonKey);
    const { data, error } = await supa.auth.getUser(token);
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
  if (!UPGRADE_TARGETS.has(priceId)) {
    return json({ error: "Unknown or unavailable price" }, 400);
  }

  // The subscription id comes from the user's OWN profile row under RLS, never from the
  // request body. Taking it from the body would let any signed-in user rewrite a stranger's
  // subscription — the whole authorisation for this endpoint is "you can only touch the
  // subscription recorded against your own account", and it is written only by the webhook.
  let subscriptionId;
  try {
    const supaAsUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: profile, error } = await supaAsUser
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return json({ error: "Could not read your account" }, 500);
    subscriptionId = profile?.stripe_subscription_id || null;
  } catch (e) {
    return json({ error: "Could not read your account" }, 500);
  }

  // No subscription: this is a new purchase, not an upgrade. Say so explicitly rather
  // than silently doing nothing — the client sends them to checkout instead.
  if (!subscriptionId) {
    return json({ error: "No active subscription to upgrade", code: "NO_SUBSCRIPTION" }, 409);
  }

  const stripeHeaders = {
    Authorization: `Bearer ${stripeKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  try {
    // Fetch the subscription to get the ITEM id. Stripe updates a subscription by
    // replacing the item, not by naming a price on the subscription itself, so the item
    // id is required and there is no way to skip this round trip.
    const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const sub = await subRes.json();
    if (!subRes.ok) {
      return json({ error: sub.error?.message || "Could not read the subscription" }, subRes.status);
    }

    const item = sub?.items?.data?.[0];
    if (!item?.id) return json({ error: "Subscription has no billable item" }, 409);

    // Already on it. Answering 200 rather than an error because from the user's side
    // nothing is wrong — they asked to be on Premium and they are.
    if (item.price?.id === priceId) {
      return json({ ok: true, alreadyOnPlan: true }, 200);
    }

    const params = new URLSearchParams();
    params.set("items[0][id]", item.id);
    params.set("items[0][price]", priceId);
    // Credit the unused portion of what they already paid and charge the difference now.
    // The alternative, "none", would give them Premium for free until their renewal date.
    params.set("proration_behavior", "create_prorations");
    // Keep the tier on the subscription itself, because stripe-webhook.mjs reads
    // metadata.plan from customer.subscription.updated to decide what to grant. Without
    // this, the upgrade event would arrive carrying the OLD plan and the webhook would
    // helpfully set them back to "paid" moments after they paid for premium.
    params.set("metadata[plan]", "premium");

    const upRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: "POST",
      headers: stripeHeaders,
      body: params.toString(),
    });
    const updated = await upRes.json();
    if (!upRes.ok) {
      return json({ error: updated.error?.message || "Upgrade failed" }, upRes.status);
    }

    // Deliberately NOT writing app_metadata.plan here. The webhook owns that, from
    // customer.subscription.updated, and two writers for one field is how it ends up
    // disagreeing with Stripe. The client polls its session instead.
    return json({ ok: true, status: updated.status }, 200);
  } catch (e) {
    return json({ error: "Upstream request failed" }, 500);
  }
};

// Same shape as every other function here: withCors takes (req, res), not a handler, and
// the OPTIONS preflight has to be answered before the handler runs. The native app calls
// this from capacitor://localhost, which is a cross-origin request, so a missing preflight
// means the upgrade silently fails on device and works fine in a browser — exactly the
// class of bug that broke every AI call on the first on-device run.
// Routing is a redirect in netlify.toml, matching the other /api/* paths.
export default async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  return withCors(req, await handler(req));
};
