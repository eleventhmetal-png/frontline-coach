# Release gate — what has to be true before tapping Release

Written 2 Sep 2026. iOS 1.0 (build 6) is approved and sitting in Pending Developer
Release. This is the checklist that replaces "release on 1 October" — a date does none
of the work, and holding a month to finish a week of it is how solo projects drift.

---

## Done

- [x] **Premium gate exists.** It didn't. `PREMIUM_AFTER_BETA` drew a badge and printed a
      sentence; the tools were open to everyone. Now enforced in `claude.mjs` against a
      tool id the client sends, before the credit spend.
- [x] **Premium is buyable.** On the trial paywall, and via `/api/upgrade-subscription`
      for someone already on Standard — an in-place price change, not a second
      subscription.
- [x] **Both enforcement dates are 1 October**, from one shared constant
      (`src/lib/plans.js`) that the browser and two functions import.
- [x] Founding, Standard monthly and annual all sellable and on the paywall.
- [x] Trial-ending emails deployed and scheduled.
- [x] Support page live; `ITSAppUsesNonExemptEncryption` set.

## Blocking — do not release until these are true

- [ ] **A real purchase has completed end to end.** Nothing has ever been bought. Zero
      subscriptions, founding 0 of 100. Every path above is inspection, not proof, and
      this codebase has been bitten by exactly that distinction before (the 4.7 report
      path, the consent gate, the paywall button that returned 400 for months).

      **The 90-second test:** on a non-pilot account whose trial has expired, buy the
      $7.99 founding rate. Then check:
      ```sql
      select email, is_founding, founding_slot_claimed_at, stripe_subscription_id
        from public.profiles where email = '<the test account>';
      ```
      `is_founding` true, a claim timestamp, a subscription id. Then confirm the tools
      unlock. Then refund and cancel in Stripe, and tell me — I'll clear the burnt
      founding slot so the count starts at 100 again.

- [ ] **Age rating.** 9+ on a US-only listing, for an app with unfiltered AI output about
      workplace discipline. Redo the questionnaire in App Information. This one is Ben's:
      the answers are a declaration about the product.

- [ ] **iOS can take money.** The store build's paywall still says "there's nothing to buy
      here." Until the Stripe link-out ships, the trial-ending email is the only route an
      iPhone user has to subscribe — which works, and is legal, but means every iOS
      conversion goes through a browser.

## Ships in the same build, one review round

- [ ] Stripe link-out in the store build (US storefront, Guideline 3.1.1(a), no
      entitlement and no Apple commission — see the iOS billing notes).
- [ ] Sign in with Apple. Needs the capability enabled on the App ID in the Developer
      portal and added in Xcode before the Supabase side can be configured.
- [ ] App Review Notes — text ready in `docs/app-review-notes-next.md`. Every field on the
      version page is locked while Pending Developer Release, so this can only go in with
      the next version.
- [ ] Description still lists Follow-through, which is Premium from 1 October, on a
      listing that says "Free".

## Timing

The 1 October enforcement date is now the real deadline, and it is not about the App
Store. On that date Standard subscribers lose 1:1 Prep, Follow-through and the practice
voice. If the upgrade path is not live and tested by then, the people who already paid
are the ones who get hurt.

Everything above is achievable well before that. The gate is readiness, not the calendar.
