# App Store Connect reply — 25 Aug 2026 rejection

Submission ID 32b9f572-8b39-44ef-8870-d648f105a52e · version 1.0 (4) · reply goes with build 1.0 (6)

Three items came back: 4.8 (login services), 5.1.1(i)/5.1.2(i) (third-party AI data), 2.1(b) (business model).
All three are addressed in the binary. Paste the block below into the App Store Connect message thread.
Keep it under the 4,000-character field cap — the text as written is 3,937 characters. Plain text, no
markdown, because the App Store Connect message field renders none.

---

## PASTE THIS

Thank you for the detail. All three items are addressed in build 6, submitted with this reply.

Guideline 4.8 — Login Services

The Google sign-in option has been removed from the iOS build. Build 6 offers one way to create an account and sign in: email address and password, handled by our own backend. There is no third-party login service in the app, so no equivalent third-party option is required. Nothing about the account requires a social identity, and we collect only an email address and a password.

Guidelines 5.1.1(i) and 5.1.2(i) — Third-party AI

The app does send user-entered text to a third-party AI service, and it asks permission first. That permission screen exists in the previous build but appeared at the moment of the first outbound request, so a reviewer who did not send a message would not have seen it. In build 6 it appears immediately after sign-in, before any feature can be used.

The screen states, in the app and not only in the policy:

- What is sent: only the text the user types or dictates into a coaching tool. No contacts, location, identifiers, photos, or usage analytics.
- Who it is sent to, by name: Anthropic (Claude API) generates every text response. OpenAI (text-to-speech) receives only the app's own generated reply, and only if the user turns on read-aloud; the user's own words are never sent to OpenAI. Dictation is performed on-device by Apple's speech recognizer — we never receive audio, only text.
- That neither provider uses this content to train models, under our commercial API terms.
- A request to leave out medical, disciplinary, or otherwise sensitive detail about coworkers.

Nothing is sent until the user taps "I understand, continue." Declining sends nothing and the tools stay unavailable. The permission is recorded against the account and can be withdrawn at any time under Tools → Data and privacy, which stops all AI processing.

The Privacy Policy (reachable from the sign-in screen and from Tools, and updated 25 August 2026) identifies the data collected, how it is collected, every use of it, each third party it is shared with, and confirms in writing that each of those providers is contractually required to protect it to the same or an equivalent standard, to process it only on our instructions, and not to use it for their own purposes or model training.

Guideline 2.1(b) — Business model

Nothing in the app is for sale, and nothing ever has been.

1. Who uses the paid content: no one. There is no paid content, paid tier, or subscription in the app. Every feature is available to every signed-in account at no cost.
2. Where users purchase content accessed in the app: nowhere. No purchase mechanism of any kind exists in the app or outside it for anything the app unlocks.
3. Previously purchased content accessible in the app: none. No user has ever purchased anything.
4. Paid content, subscriptions, or features unlocked without In-App Purchase: none. Build 4 contained a trial-expiry screen with a web checkout link that we had not intended to be reachable in a store build. That screen sells nothing in build 6, and the marketing pricing page has been removed from the binary. There are no prices, no purchase links, and no external checkout anywhere in the app. Our build now fails automatically if a price string appears in it. Two tools carry a "Premium" label with a note that they move to a Premium plan on 15 November 2026. That label is advance notice to our users, not a purchase: both tools are fully open to every account today, no price is shown, and nothing can be bought.
5. How users obtain an account: they enter an email address and a password. There is no fee to create an account, and no payment information is ever requested.

If we introduce paid access on iOS in future, it will comply with the App Review Guidelines in force at that time, and the version that introduces it will be submitted for review before it ships.

---

## Before sending

1. Confirm the demo account's AI-permission record is cleared, so the reviewer sees the screen:
   `select email, raw_user_meta_data->>'ai_consent_version' from auth.users order by created_at desc limit 20;`
   Clear it with:
   `update auth.users set raw_user_meta_data = raw_user_meta_data - 'ai_consent_version' - 'ai_consent_at' where email = '<demo>';`
   ORDER MATTERS: sign out inside the app FIRST. The device holds a JWT carrying the old
   metadata, so clearing the row while signed in changes nothing on the phone.
2. Screenshots need no change — the six-shot set (practice, debrief, coach, pushback, diagnose,
   home) never included the sign-in screen, so the Google button was never in the metadata.
3. Confirm on device: sign in as the demo account, permission screen appears before anything else,
   and Tools → Data and privacy can withdraw it. Then clear the row again — verifying it consumes it.
4. Verify the demo account's `trial_ends_at` is still pinned far out and `is_internal_pilot = true`, so review never lands on the trial-ended screen at all.
5. Screen recording: it MUST show the permission screen. Two takes have now failed this because the
   demo account was pre-consented — sign out, clear the row, force-quit, then roll tape.
