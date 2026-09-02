import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Frontline Coach — Stripe webhook handler. Keeps auth.users.app_metadata.plan
// (the field claude.mjs actually reads to gate tier) in sync with what's
// really happening in Stripe. This is the only thing that flips a paying
// customer's access on or off -- checkout succeeding does nothing by itself.
//
// Required env vars (Netlify):
//   STRIPE_WEBHOOK_SECRET       - signing secret from the endpoint you
//                                 register in Stripe -> Developers -> Webhooks
//                                 (whsec_...). Without this, signature
//                                 verification is impossible and this
//                                 function must reject everything.
//   SUPABASE_SERVICE_ROLE_KEY   - same as synthesize-memory.mjs. Needed
//                                 because updating app_metadata requires the
//                                 Admin API, which only the service role can call.
//   SUPABASE_URL / VITE_SUPABASE_URL
//
// Manually verifies the Stripe signature (HMAC-SHA256) instead of pulling in
// the Stripe SDK, matching the plain-fetch style already used elsewhere in
// this codebase (claude.mjs, create-checkout-session.mjs).

// Which tier a Stripe object's metadata grants. create-checkout-session.mjs stamps
// metadata[plan] on both the checkout session and the subscription, from its own price
// catalogue, so this function never has to know price IDs or call the Stripe API.
//
// Only "premium" is special-cased. Anything else — including missing metadata from a
// subscription created before 1 Sep 2026, or one made by hand in the dashboard —
// resolves to "paid". Failing to "free" would lock out a customer who has actually
// been charged, and that is a far worse error than briefly over-granting.
function planFromMetadata(metadata) {
  return metadata?.plan === "premium" ? "premium" : "paid";
}

function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSeconds = 300) {
  if (!sigHeader) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const idx = kv.indexOf("=");
      return [kv.slice(0, idx), kv.slice(idx + 1)];
    })
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  // Reject stale events -- protects against a captured payload + signature
  // being replayed later.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedHex = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "hex");
  const actualBuf = Buffer.from(v1, "hex");
  if (expectedBuf.length !== actualBuf.length) return false; // timingSafeEqual requires equal length
  return timingSafeEqual(expectedBuf, actualBuf);
}

export default async (req) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!webhookSecret || !serviceRoleKey || !supabaseUrl) {
    return json({ error: "Server not configured" }, 500);
  }

  // Raw text, NOT req.json() -- signature verification is computed over the
  // exact bytes Stripe sent. Parsing to JSON first and re-stringifying would
  // not reliably reproduce the same bytes (key order, whitespace, etc.).
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!verifyStripeSignature(rawBody, sig, webhookSecret)) {
    return json({ error: "Invalid signature" }, 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return json({ error: "Invalid payload" }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    switch (event.type) {
      // Fires once, right after a successful checkout. This is the ONLY
      // event that carries client_reference_id, because that field lives on
      // the Checkout Session, not on the subscription object itself. So this
      // is the one moment we can link a Stripe subscription to a Frontline
      // Coach user -- every later event (renewals, cancellations) has to look
      // the user up by the stripe_subscription_id we save here.
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (!userId) break; // shouldn't happen -- create-checkout-session.mjs always sets this

        // WHICH TIER. create-checkout-session.mjs stamps metadata[plan] with the plan
        // the purchased price grants — "paid" for Standard and Founding, "premium" for
        // Premium. Hardcoding "paid" here (as this did until 1 Sep 2026) meant a
        // customer could buy Premium at $24.99 and still be locked out of the two
        // tools they paid for, because PREMIUM_AFTER_BETA in App.jsx gates on
        // plan === "premium".
        //
        // Falls back to "paid" rather than "free" if the metadata is missing: money
        // has changed hands, so the failure mode has to be "they get access we can
        // correct" and never "they paid and got nothing".
        const plan = planFromMetadata(session.metadata);

        const { error: planError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          app_metadata: { plan },
        });
        if (planError) throw new Error(`updateUserById (plan=${plan}) failed: ${planError.message}`);

        // FOUNDING CLAIM. This is the only place a slot is ever spent, and it happens
        // here rather than at checkout creation because creating a session is not a
        // purchase — an abandoned checkout must not burn one of the hundred.
        //
        // founding_slot_claimed_at is written ONCE and never cleared: the slot stays
        // spent even if they cancel, so nobody inherits it and the "first 100 to
        // purchase" claim can be audited later without replaying Stripe history.
        // is_founding is the live entitlement, cleared on cancellation below.
        //
        // The service role has no auth.uid(), so lock_profile_role() lets these two
        // columns through — which is exactly why that guard is wrapped in an
        // auth.uid() check. A browser cannot write either one.
        const profileUpdate = {
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
        };
        if (session.metadata?.founding === "1") {
          profileUpdate.is_founding = true;
          profileUpdate.founding_slot_claimed_at = new Date().toISOString();
        }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update(profileUpdate)
          .eq("id", userId);
        if (profileError) throw new Error(`profiles update failed: ${profileError.message}`);
        break;
      }

      // Covers renewals, plan changes, failed-payment status changes, and
      // recoveries. Bidirectional on purpose: a lapsed card that gets fixed
      // and returns to "active" should restore paid access automatically,
      // not require you to manually flip someone back on.
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const activeStatuses = ["active", "trialing"];
        // Same tier logic, read from the subscription's own metadata — which
        // create-checkout-session.mjs sets via subscription_data[metadata][plan]
        // precisely so these later events don't need the checkout session.
        const newPlan = activeStatuses.includes(subscription.status)
          ? planFromMetadata(subscription.metadata)
          : "free";

        const { data: profile, error: lookupError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();
        if (lookupError) throw new Error(`profiles lookup failed: ${lookupError.message}`);

        if (profile?.id) {
          const { error: planError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
            app_metadata: { plan: newPlan },
          });
          if (planError) throw new Error(`updateUserById (plan=${newPlan}) failed: ${planError.message}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        const { data: profile, error: lookupError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();
        if (lookupError) throw new Error(`profiles lookup failed: ${lookupError.message}`);

        if (profile?.id) {
          const { error: planError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
            app_metadata: { plan: "free" },
          });
          if (planError) throw new Error(`updateUserById (plan=free) failed: ${planError.message}`);

          // THE FOUNDING RATE ENDS WITH THE SUBSCRIPTION, the claim does not.
          // The pricing page: "Cancel and the rate goes with you — you'd rejoin at
          // $14.99." So clear is_founding, and deliberately leave
          // founding_slot_claimed_at in place. That does two things: the checkout gate
          // refuses to sell them $7.99 again, and the slot stays spent rather than
          // being handed to the next person, which is what "first 100 to purchase"
          // means when read literally.
          if (subscription.metadata?.founding === "1") {
            const { error: foundingError } = await supabaseAdmin
              .from("profiles")
              .update({ is_founding: false })
              .eq("id", profile.id);
            if (foundingError) {
              throw new Error(`clearing is_founding failed: ${foundingError.message}`);
            }
          }
        }
        break;
      }

      default:
        break; // ignore event types we don't act on
    }
  } catch (err) {
    // Non-2xx makes Stripe retry with backoff -- correct behavior if our own
    // DB call failed transiently. NOTE: no alerting on this yet. Sentry is
    // already wired up client-side (sentry.js) -- piping server-side errors
    // like this one there too is worth doing before relying on this for real
    // money, so a failure here doesn't go unnoticed.
    console.error("stripe-webhook error:", err);
    return json({ error: "Internal error processing webhook", detail: String(err?.message || err) }, 500);
  }

  return json({ received: true }, 200);
};
