# App Review reply — Guideline 2.1 Information Needed

Frontline Coach · com.otsmedia.frontlinecoach · OTS Media LLC
Drafted 21 Aug 2026

---

## DO THESE THREE THINGS BEFORE YOU REPLY

**1. ~~Create the demo account~~ — DONE.** Verified 21 Aug 2026: the demo credentials sign in on the store build, on a physical iPhone. Access is not the problem.

That leaves two readings of why Apple asked, and the work is the same either way:

- The account didn't exist yet when the reviewer tried it, and now does. Fixed.
- The account worked and Apple simply wants the Notes and the recording, which is a routine ask on a first submission — especially for an app that sends user text to third-party AI.

**Still pin the demo account's trial.** New accounts get `trial_ends_at = now() + 7 days`, and `Paywall` is **not** gated by `IS_STORE_BUILD`. If review runs past the trial, the reviewer gets pushed to a Stripe web checkout — a Guideline 3.1.1 fight you do not want mid-review. Run this in Supabase:

```sql
update public.profiles
set is_internal_pilot = true,
    trial_ends_at     = '2027-06-01 00:00:00-05'
where email = 'appreview@otsowntheshift.com';
```

Note for any future demo account: `handle_new_user` raises `DOMAIN_BLOCKED` on any `@clubcarwash.com` address, so never use your work domain.

**2. Record on the physical phone.** Not the simulator. Apple asked explicitly.

**3. Fill the Notes field.** Apple's last line — "Include this information in the Notes field for future submissions" — means an empty Notes field is what triggered this. Paste the block below and it doesn't happen again.

---

## SCREEN RECORDING — SHOT LIST

One take, iPhone 17 Pro Max, 3–4 minutes. Start with the app closed. Don't narrate, don't rush, let each screen sit ~2 seconds so the reviewer can read it.

| # | What to show | Why Apple asked |
|---|---|---|
| 1 | Tap the icon from the home screen. Let the launch screen play. | "Must begin with launching the app" |
| 2 | Sign in with the demo credentials. Show the email and password being typed. | Login flow |
| 3 | The third-party AI consent sheet on the first AI action — read it on camera, tap accept. | 5.1.2(i), and it's a "prompt requesting access to sensitive data" |
| 4 | Home: pick an industry from Coaching For. | Core flow |
| 5 | Coach me through a situation → type a real scenario → show the plan streaming in → toggle Quick card / Full plan. | Core feature |
| 6 | Practice a conversation → **tap the mic** → let the iOS microphone and speech-recognition prompts appear on screen → say a line → show the AI employee reply. | Purpose strings + sensitive-capability prompt. This is the one they most want to see. |
| 7 | End & score this conversation → scroll the Debrief. | Core feature |
| 8 | Handle pushback → show the output → tap **Report a problem with this response** → show the report form. | Content reporting mechanism |
| 9 | More → Settings → **Delete account** → go all the way through the confirmation. Use a throwaway second account, not the demo one. | 5.1.1(v) account deletion |
| 10 | Back to Home to show the app still runs. | Clean ending |

**Do not** show anything that says "beta." The store build strips it, but check as you record.

---

## PASTE THIS INTO APP REVIEW INFORMATION → NOTES

Everything below the line goes in the Notes field verbatim. Two spots need your input — they're marked `[[ ]]`.

---

**DEMO ACCOUNT**

Email: `[[appreview@otsowntheshift.com]]`
Password: `[[password]]`

There is one account type. This account has full access to every feature with no time limit and no payment required. No other credentials are needed.

**2. DEVICES AND OS TESTED**

iPhone 17 Pro Max, iOS `[[fill in exact version — Settings › General › About › Software Version]]`. Physical device, not simulator. The app is submitted for iPhone only; it does not declare iPad support.

**3. WHAT THE APP DOES AND WHO IT IS FOR**

Frontline Coach is a leadership tool for frontline and shift managers — retail, restaurants, hospitality, car washes, warehouses and similar hourly-workforce settings.

The problem: most frontline supervisors are promoted off the floor because they were good at the work, then are expected to run difficult employee conversations — attendance, slipping standards, pushback on a task, an employee who is about to quit — with no management training at all. They either avoid the conversation or handle it badly.

The app gives them a plan before the conversation, a place to rehearse it, and feedback after. Five tools:

- **Coach** — describe a situation in plain language, get a specific plan: what you own, the standard, what to say, what to ask.
- **Pushback** — the words to use when an employee pushes back in the moment.
- **Practice** — rehearse the conversation out loud against an AI employee, then get scored on four specific behaviors.
- **Diagnose skill vs. will** — work out whether a performance problem is a training gap or an accountability gap.
- **Follow-through** — a list of what the manager said they would check on.

Content is written by Ben Ryan, a multi-site operations director, and is original to OTS Media LLC.

The app displays a persistent disclaimer on every screen: "Not legal or HR advice. Always follow your company's policies."

**4. HOW TO SET UP AND REACH THE MAIN FEATURES**

1. Launch the app and sign in with the demo account above. Sign-in is email and password; "Continue with Google" is also available but is not needed for review.
2. On the first action that sends text to an AI service, a consent sheet appears naming each processor. Tap to accept. It can be revoked later in More → Settings.
3. On Home, pick a setting under "Coaching For" (Restaurant, Retail, Hotel, etc.). "General" works for any team.
4. Tap **Coach me through a situation** and type any workplace scenario — for example: "One of my employees has been 10 to 15 minutes late four shifts in a row." A written plan is returned.
5. Tap **Practice a conversation** to rehearse against an AI employee. Typing works; the microphone button enables speaking instead. iOS will prompt for Microphone and Speech Recognition on first use. Tap **End & score this conversation** for the debrief.
6. **Handle pushback** and **Diagnose skill vs. will** are on the Home screen and the bottom tab bar.
7. Every AI response has a "Report a problem with this response" link beneath it.
8. Account deletion: More → Settings → Delete account. This permanently deletes the account and all associated coaching content.

No sample files are needed. Any typed scenario works.

**5. EXTERNAL SERVICES USED**

- **Anthropic (Claude)** — generates all written coaching output and the AI employee in Practice. Models: claude-sonnet-5 and claude-haiku-4-5. Requests are proxied through our own server function; the API key is never present in the app binary.
- **OpenAI** — text-to-speech only (model gpt-4o-mini-tts), used for the optional read-aloud of coaching output. No user text is used for training; we declined data sharing.
- **Apple Speech framework (on-device)** — speech-to-text for the Practice microphone, via SFSpeechRecognizer. This is the only use of the microphone.
- **Supabase** — authentication and the Postgres database holding the user's account and their own coaching content.
- **Netlify** — web hosting and the serverless functions that proxy the AI calls.
- **Stripe** — payment processing. Not exercised during the current free period; no purchase is required or presented to reach any feature in this build.

Users are shown a consent sheet naming Anthropic, OpenAI and on-device dictation before any text leaves the device, per Guideline 5.1.2(i). Consent is recorded against the account and is revocable in Settings.

**6. REGIONAL DIFFERENCES**

None. The app is available in the United States only and is English-only. Features, content and pricing are identical for every user; there is no region-dependent behavior, geofencing or location data collection of any kind.

**7. REGULATED INDUSTRY / THIRD-PARTY MATERIAL**

Not applicable. This is a general workplace communication and leadership skills app. It is not a regulated service, does not provide legal, HR, medical or financial advice, and holds no protected third-party material — all coaching content is original work owned by OTS Media LLC. The disclaimer noted in item 3 is shown on every screen of the app.

**ON USER-GENERATED CONTENT**

There is no social layer. Users cannot see, share with, or message each other, and nothing a user writes is visible to any other account. The reporting mechanism exists so users can flag an inappropriate AI response, which is reviewed by us.

---

## AFTER YOU SEND IT

Save this text in App Store Connect permanently. The Notes field carries forward, so every future submission starts with the reviewer already knowing what the app is and how to get in — which is the whole reason this rejection happened.
