# Reviewer demo account

Apple cannot review an app they can't sign into. No credentials means a Guideline 2.1 rejection with no code to fix — you just lose the review cycle.

---

## The trap nobody warns you about

Your free plan is **100 credit points per day** (`PLAN_LIMITS` in `src/lib/credits.js`). A reviewer poking through Coach, Pushback, Practice and Diagnose to see whether the app does what the listing claims will burn through that. When they run out, the app stops answering — and to a reviewer that reads as "the app is broken," not "I hit a quota."

So the demo account gets **`plan = "premium"`**: 2400 points instead of 100, and it unlocks the Premium tools (1:1 Prep, Follow-through) that gate after 15 November. A reviewer should see the whole product.

`plan` is read from `session.user.app_metadata.plan` (`planFromSession` in `src/lib/usage.js`). Only the service role can write it — users can't self-upgrade, which is why this is a SQL step and not a settings toggle.

---

## Step 1 — Create it through the app, not through SQL

Sign up normally at frontline-coach.com using the email form. **Not Google** — a reviewer can't use your Google account, and OAuth in review is a needless failure point.

Going through the real signup means `handle_new_user()` populates everything correctly: profile row, `tos_accepted_at`, `tos_version`, `trial_ends_at`. Hand-inserting a user row skips those and you get odd behaviour that's hard to trace.

Constraints from the code, so you don't waste attempts:

- **Not an `@clubcarwash.com` address** — `handle_new_user()` raises `DOMAIN_BLOCKED`. That guard is a compliance rule tied to your CCW obligations, not a beta rule, and it doesn't expire.
- **Password at least 8 characters** (`MIN_PASSWORD` in `AuthGate.jsx`).
- **Tick the Terms box** — signup won't proceed without it.

Suggested address: something at a domain you control, e.g. `appreview@otsowntheshift.com`. It must be an inbox you can actually reach if Supabase has email confirmation switched on.

## Step 2 — Patch it in Supabase

Supabase dashboard → SQL Editor. Replace the email, run it:

```sql
-- 1. Don't let the demo account consume one of your 30 beta slots.
update public.profiles
set is_internal_pilot = true
where email = 'appreview@otsowntheshift.com';

-- 2. Premium, so a reviewer never hits the 100-point free wall
--    and can see the tools that gate after 15 Nov.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                        || '{"plan":"premium"}'::jsonb
where email = 'appreview@otsowntheshift.com';

-- 3. Confirm it took.
select u.email,
       u.raw_app_meta_data ->> 'plan' as plan,
       p.is_internal_pilot,
       p.tos_accepted_at
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'appreview@otsowntheshift.com';
```

Expected: `plan = premium`, `is_internal_pilot = true`, `tos_accepted_at` not null.

**Then sign out and back in on the app.** `plan` is read from the session's JWT, so an existing session keeps the old value until the token refreshes.

## Step 3 — Make a second one

Your app has account deletion, because Guideline 5.1.1(v) requires it. A reviewer testing that feature **deletes your demo account**, and any follow-up review attempt then fails to sign in.

Create `appreview2@...` the same way. Costs five minutes and removes a failure mode you cannot otherwise control.

---

## Step 4 — Paste this into App Store Connect

**App Review Information → Sign-In Required: ON**

- User name: `appreview@otsowntheshift.com`
- Password: *(the one you set)*

**Notes:**

```
SIGNING IN
Use the email and password above on the "Sign In" tab. Please do not use
"Continue with Google" — it is available to users but the demo account is
email/password only.

ON FIRST AI ACTION
A one-time consent sheet appears naming the third-party AI providers used
(Anthropic for text, OpenAI for the read-aloud voice). Tap Accept to
continue. This is deliberate, per Guideline 5.1.2(i) — no user content is
sent anywhere until consent is given.

WHAT TO TRY
1. Home > "Coach me through a situation". Type any workplace situation,
   e.g. "an employee keeps showing up late". Returns a structured plan.
2. Practice > pick a scenario > tap the microphone and speak a line. Uses
   on-device speech recognition. Tap "End & score this conversation" for a
   graded debrief.
3. Pushback > describe an objection you might hear from an employee.

MICROPHONE AND SPEECH RECOGNITION
Requested only when the microphone button is tapped in Practice, never at
launch. Used to let a manager rehearse a difficult conversation out loud
instead of typing it.

ACCOUNT DELETION
Available in-app: More > Delete account. It permanently removes the
account and all associated data.

SUBSCRIPTIONS
The app is free to all users at present. Subscription information is
informational only and any purchase happens on our website, outside the
app. This app is available on the United States storefront only.
```

Adjust the "What to try" wording to match your final tab names.

---

## Before you hit submit

- [ ] Demo account signs in on the **device build**, not just the website
- [ ] `plan` reads `premium` — the credits pill on Home should not show a low number
- [ ] The AI consent sheet appears and accepting it works
- [ ] Coach returns a plan (proves the app reaches its backend from the binary)
- [ ] Microphone works in Practice
- [ ] More > Delete account is findable — a reviewer looks for this specifically
- [ ] Second demo account exists and signs in
- [ ] App Store Connect availability set to **United States only** (see the storefront decision — this is what makes the external Stripe link compliant)
