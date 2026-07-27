# Auth Email Setup — Resend SMTP for Supabase

**Status:** DONE 2026-07-27. Resend SMTP live on `auth.frontline-coach.com`; confirmation
email verified arriving to a non-team address.
**Owner:** Ben
**Still open:** password-reset flow untested; the 30 msg/hour throttle has not been raised.

> **What the failure actually was.** Supabase's "Confirm email" setting was ON the whole
> time, so Supabase genuinely tried to send. The default sender refused because the test
> address wasn't a Supabase team member — the documented `Email address not authorized`
> behavior. Custom SMTP was the correct and only fix.
>
> A wrong turn worth recording: a 25ms gap between `created_at` and `email_confirmed_at` on
> one account looked like proof that email confirmation was disabled. It wasn't — that row
> came from a **Google OAuth** signup, which skips confirmation because Google already
> verified the address. Instant confirmation timestamps are normal for OAuth and prove
> nothing about the email settings. Check the toggle before theorizing from timestamps.

---

## The problem this fixes

Supabase ships a default email sender so you can test templates. It has two hard limits:

1. **It refuses to deliver to any address that isn't a member of your Supabase project team.**
   Everyone else fails with `Email address not authorized`.
2. **2 messages per hour**, with no SLA, and Supabase can change it without notice.

Discovered 2026-07-27: signing up with a non-team email address produced the "check your
email" notice and no email ever arrived. That is the documented behavior, not a bug in the
app.

**Why it matters more than it looks.** The account *is* created. `handle_new_user()` fires,
a `profiles` row is written, and a beta slot is consumed — but the user can never confirm
and never sign in. Every email signup silently burns a slot and creates a dead account.
Password reset runs through the same sender, so that's broken too.

Right now only **Continue with Google** actually works.

Source: [Supabase — Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

---

## Step 1 — Clean up the dead accounts first

In the Supabase SQL editor:

```sql
select id, email, created_at, email_confirmed_at
from auth.users
where email_confirmed_at is null
order by created_at desc;
```

Delete anything that comes back via **Authentication → Users**. Unconfirmed accounts still
hold beta slots against the cap of 30.

Then confirm your real external count:

```sql
select count(*) from public.profiles where is_internal_pilot = false;
```

---

## Step 2 — Decide the sending domain

**Use `auth.frontline-coach.com`.** Verify that subdomain in Resend, not the root domain,
and send from `no-reply@auth.frontline-coach.com`.

Why a subdomain instead of the root: beta invites and waitlist notifications are
marketing-adjacent mail. If those ever get flagged as spam, a shared sending reputation
takes password reset and email confirmation down with them — and those are the two messages
that lock people out of the product entirely. Separating them costs zero extra DNS work.
Supabase recommends exactly this split.

The simpler alternative is verifying the root `frontline-coach.com` and sending from
`no-reply@frontline-coach.com`. It looks marginally cleaner in an inbox and is fine for a
30-person beta. It just gives up the isolation above.

---

## Step 3 — Resend account and domain

1. Create an account at [resend.com](https://resend.com). The free tier covers a 30-person
   beta with room to spare.
2. **Domains → Add Domain** → enter `auth.frontline-coach.com`.
3. Resend shows a set of DNS records — DKIM (TXT), SPF (TXT or MX), and a DMARC record.
   Add all of them wherever `frontline-coach.com` DNS is hosted.
4. Wait for Resend to show the domain as **Verified**. Usually minutes; DNS can take a few
   hours.

Do not skip DKIM/SPF/DMARC. They're the difference between landing in the inbox and landing
in spam, and Supabase's own guidance calls them out specifically.

**API key:** Resend → **API Keys** → Create. Copy it once — it isn't shown again. This value
becomes the SMTP password below.

---

## Step 4 — Configure Supabase

Supabase Dashboard → **Authentication** → **Emails** → **SMTP Settings** → enable custom SMTP.

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |
| Sender email | `no-reply@auth.frontline-coach.com` |
| Sender name | `Frontline Coach` |

Save.

Source: [Resend — Send emails using Supabase with SMTP](https://resend.com/docs/send-with-supabase-smtp)

---

## Step 5 — Raise the rate limit

Saving custom SMTP applies a fresh-sender throttle of **30 messages per hour**. Check it at
**Authentication → Rate Limits**.

30/hour is fine for a 30-person closed beta. Raise it before any traffic push — a YouTube
video landing 200 signups in an hour would silently fail past message 30.

---

## Step 6 — Test it properly

1. Sign out, or use an incognito window.
2. Sign up with a **real address you control that is NOT a Supabase team member**. That's
   the whole point — a team address would have worked before this change and proves nothing.
3. Confirm the email arrives, the link works, and you can then sign in.
4. Test password reset from the sign-in screen too. Same sender, separate flow.
5. Check Resend → **Logs** to see the send recorded, and note whether it landed in inbox or
   spam.
6. Delete the test account afterward so it doesn't hold a beta slot.

---

## Hardening (before opening past the closed beta)

- **Add CAPTCHA.** Supabase names bot signup floods as the main threat to a sending
  reputation, and CAPTCHA as the most effective control. Invisible challenges mean real
  users rarely see a puzzle. See
  [Bot Detection (CAPTCHA)](https://supabase.com/docs/guides/auth/auth-captcha).
- **Do not disable email confirmation**, especially under pressure. Supabase calls this out
  as a known attacker goal — it enables account takeover via social engineering.
- **Keep auth mail and marketing mail on separate domains and separate From addresses.**
  Waitlist notifications currently come from Netlify Forms, so there's no conflict yet.
  Keep it that way.
- **Keep auth email templates boring.** No taglines, no promotional copy, few links, few
  images. Spam filters classify marketing-flavored auth mail as marketing.
- **Have a backup SMTP provider on standby** for when Resend has a bad day.

---

## Related

- Beta gate: `supabase/migrations/20260724000000_beta_gate.sql` — cap 30, closes
  2026-11-15. `handle_new_user()` is the real gate; `beta_status()` is UX only.
- Waitlist capture: `handleWaitlist()` in `src/AuthGate.jsx`, posting to the
  `beta-waitlist` Netlify form declared in `index.html`.
