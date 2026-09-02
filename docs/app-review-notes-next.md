# App Review Information → Notes — paste this into the next version

Drafted 2 Sep 2026 for the version after 1.0 (build 6).

**Why it isn't already in there:** every field on the version page — notes, description,
promotional text, keywords, support URL — is **disabled while the version is Pending
Developer Release**. The only way to edit them now is to cancel the release, which
discards the approval. So this waits for 1.0.1.

An empty Notes field is what drew the Guideline 2.1 information request on 21 August.
Do not submit 1.0.1 without pasting this in.

**Update before pasting** if the 1.0.1 build adds the Stripe link-out: the "nothing is for
sale" section becomes wrong. Replace it with a statement that the app links out to an
external purchase on the US storefront under Guideline 3.1.1(a), which requires no
entitlement and carries no Apple commission — and say that the app is available in the
United States only, because that is what makes it permitted. A reviewer unfamiliar with
the post-2025 US rules is the likeliest reason 1.0.1 gets questioned.

---

## PASTE THIS (2,401 characters)

WHAT THE APP IS
Frontline Coach is an AI coaching tool for newly promoted supervisors and shift managers in hourly operations. The user describes a situation with an employee and gets a plan, the words to use when someone pushes back, or a practice conversation against an AI counterpart. One user per account. There is no social layer, no user-to-user content, and nothing any other user can see.

SIGN IN
Email and password only. No third-party login service is offered in this build, so no equivalent option is required under Guideline 4.8. Demo credentials are in the Sign-In Information fields above.

THIRD-PARTY AI, AND WHERE THE PERMISSION SCREEN IS
The app sends the text the user types or dictates to third-party services, and it asks permission first. That screen appears immediately after sign-in, before any feature can be used. It names each service, says exactly what is sent, and can be withdrawn at any time under More, then Data and privacy, which stops all AI processing.

Anthropic (Claude API) generates every text response. OpenAI receives only the app's own generated reply, and only if the user turns on read-aloud in Practice; the user's own words are never sent to OpenAI. Dictation is performed on device by Apple's speech recognizer, so we never receive audio, only text. Neither provider uses this content to train models under our commercial API terms.

NOTHING IS FOR SALE IN THE APP
There is no paid content, no subscription, and no In-App Purchase in this build. Every feature is available to every signed-in account at no cost, there is no fee to create an account, and no payment information is requested anywhere. There are no prices or purchase links in the binary. Two tools carry a Premium label with a note that they move to a Premium plan on 15 November 2026; that is advance notice to our users, not a purchase, and both are fully open today.

ACCOUNT DELETION
More, then Data and privacy, then Delete my account. It removes the account and all associated data immediately, per Guideline 5.1.1(v).

REPORTING A PROBLEM
Every AI response has a Report a problem link underneath it, which is the objectionable-content path for Guideline 4.7. Reports reach us directly; we respond within three business days, same day for anything involving safety.

SUPPORT
support@otsowntheshift.com. OTS Media LLC, 11628 Old Ballas Rd, Suite 345, PMB 1228, St. Louis, MO 63141.

---

## Other metadata to fix in the same submission

1. **Support URL** → `https://frontline-coach.com/support` (the new page). Note support URL
   and promotional text become editable as soon as the app is Ready for Sale, so those two
   can be changed right after Release without waiting for 1.0.1 — the description cannot.
2. **Description** currently lists FOLLOW THROUGH as a feature. It moves behind Premium on
   15 November, on a listing that says "Free" with no in-app purchases. Either drop that
   block or add a line saying some tools move to a paid plan.
3. **Age rating** — 9+ today, in a US-only listing, for an app with unfiltered AI output on
   workplace discipline. Redo the questionnaire in App Information. Ben's call to make; the
   answers are a declaration about the product.
