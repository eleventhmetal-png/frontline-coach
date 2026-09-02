# Pre-launch review — 2 September 2026

Full pass over App Store Connect, Stripe, Supabase, and the code, before tapping
Release on iOS 1.0 (build 6, approved and Pending Developer Release).

Ranked by what actually costs you something.

---

## Blockers — decide before Release

### 1. iOS has no way to pay. This is the big one.

Rolling seven-day trials started last night, so the first ones expire around
**8 September**. When one does, `claude.mjs` returns 402 and the app shows `Paywall`.
In the store build that screen says *"There's nothing to buy here."*

So the path for an iOS user who likes the app is: seven good days, then a wall, then
nothing. No purchase, no explanation, no link. Some of them leave a one-star review on
the way out, and that review is the first thing the next visitor reads.

The fix is the Stripe link-out, which is legal on your US-only storefront under
Guideline 3.1.1(a) — no entitlement, no Apple commission (see the iOS billing notes).
Three options:

- Build the link-out, then Release. Cleanest, costs a day.
- Release now, ship 1.0.1 with the link-out inside the week. Acceptable — almost nobody
  finds an unpromoted new listing in seven days.
- Release and do nothing. Not viable. Do not pick this by default.

### 2. Age rating is 9+, and "All Ages" in Korea

An app where an AI role-plays a confrontational employee, the subject matter is
discipline and termination, and unfiltered user text goes to an LLM whose output cannot
be pre-vetted. A nine-year-old can install it today.

Apple is also re-collecting these answers — there is a banner on the Apps page about new
social-media age-rating questions. The next update will force them.

Raise it through the questionnaire in App Information. **You answer this, not me:** it is
a declaration about your own product, and the answers carry weight if anyone ever asks.

### 3. The paywall's checkout button has never worked — FIXED 2 Sep, needs deploy

`Paywall` called `go()` with no argument, so `startCheckout()` posted an empty body and
`create-checkout-session` answered 400 "Unknown or unavailable price". The one button in
the product that takes money was broken, and it went unnoticed because a web trial has to
expire while someone is looking at it and MRR is $0.

Fixed by defaulting to Standard monthly server-side. Committed, not yet deployed.

---

## Should fix around launch

### 4. App Review Information → Notes is EMPTY

This is exactly what drew the Guideline 2.1 information request on 21 August. It does not
affect the approved build, but the field stays empty for the next update. Paste the text
from `docs/app-review-notes.md` in now while you are thinking about it.

### 5. Nothing tells a user their trial is ending

No email at day five, no email at day seven, no in-app warning beyond the countdown pill
they only see if they open the app. They just hit a wall next time they show up.

For a product whose measured problem is that people do not come back, this is probably
the highest-leverage thing on this whole list, and it does not exist.

### 6. Founding and Premium cannot be bought from anywhere in the UI

Both are wired server-side and both work. But `Paywall` only offers Standard monthly, so:

- The pricing page promises the first 100 subscribers $7.99 for life. Nothing in the
  product sells it. The promise is currently unfulfillable.
- Premium at $24.99 has no upgrade path, and it is what 1:1 Prep and Follow-through gate
  to on 15 November.

### 7. Metadata: the description sells a tool that becomes Premium

The App Store description lists FOLLOW THROUGH as a feature. On 15 November it moves
behind Premium, on a listing that says "Free" with no in-app purchases declared. Minor
metadata exposure, easy to reword now.

### 8. Support URL is the homepage

`https://frontline-coach.com` is the app's sign-in screen. Someone looking for help gets
asked to log in. A plain support page with an email address would serve better.

### 9. `ITSAppUsesNonExemptEncryption` is not in `Info.plist`

Build 6 got through without it, but every upload can prompt for encryption documentation
until it is set. One key, removes a recurring question.

---

## Verified good — no action

- **Build 6 is the attached build.** Not 5. The legal-link fix is in what Apple approved.
- **Availability: US only** (1 available, 174 not). This is the condition the Stripe
  link-out depends on. If you ever expand, the link must be region-gated first.
- **App Privacy labels** — Email Address, Emails or Text Messages, Other User Content,
  Crash Data. All App Functionality, correctly linked/not-linked. Consistent with what
  the app actually sends.
- **Privacy Policy URL** `frontline-coach.com/privacy` returns 200, as do `/terms` and
  the root.
- **Demo account** `appreview@otsowntheshift.com`, password set, consent row cleared,
  contact info filled.
- **Stripe**: five prices live, the two Standard IDs match the code exactly, webhook
  active on the three events the handler switches on, signing secret set.
- **Netlify**: all eight env vars present including `SUPABASE_SERVICE_ROLE_KEY` (which
  `tts.mjs` now needs), auto-publish on, no failed builds.
- **App Store description** carries no beta wording and no stale pricing claims.
- **Release is set to manual**, which is why it is sitting in Pending Developer Release.

---

## Known and deliberate

- The **7 pre-existing accounts** still expire together on 15 November. Left alone on
  purpose; the one-line update to move them is in
  `supabase/migrations/20260901000000_open_signups_rolling_trial.sql`.
- **Voice** is metered from 1 September and refused from 15 November
  (`VOICE_ENFORCE_FROM`). Free tier gets 20 minutes for life, Standard none, Premium
  120 min/month.
- **EU trader status / DSA** is unset. Irrelevant while US-only; required before any
  EU availability.
- **Sign in with Apple** is not built. Not required, because the store build offers no
  third-party login. Needed again the moment Google returns to iOS.
