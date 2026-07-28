# Roadmap — pick up here

Last updated end of 27 July 2026. Supersedes `docs/ROADMAP.md`, which was written
earlier the same day and predates the metering build.

Ordered by leverage. The first item is the only one that changes anything.

**Shipped 27 July:** seven content pages + `/pricing` (eight total), `/operator`,
healthcare as an eighth industry, the industries section on the landing page, AI
usage metering with the credits pill, Resend transactional email, password reset,
waitlist capture, and the employer domain literal removed from the client bundle.

---

## 0. THE BINDING CONSTRAINT — get one external user

Zero people outside Ben's own company have ever used this. Everything below is
downstream of that. Seven content pages, a working meter, tested payments and a
complete auth flow are all worth nothing until somebody who doesn't report to Ben
opens the app.

Signups are OPEN (30 slots, 0 used, cap and close date both live in
`beta_gate.sql`). There is no wall — what's missing is arrival.

**Do:**
- Submit the 7 URLs in GSC → URL Inspection → Request Indexing. Batch them.
- Bing Webmaster Tools → Import from Google Search Console (one click, comes
  across pre-verified).
- Recruit outside the company: r/managers, restaurant and retail supervisor
  groups, LinkedIn. External users solve two problems at once — they're evidence
  of real demand, and unlike the pilot GMs they can be quoted publicly.

**Why the pilot GMs can't carry this:** they're Ben's subordinates. Public
testimonials from direct reports carry a power-imbalance problem and, more
practically, publishing them is the thread that connects Frontline Coach to the
employer Ben is keeping it separate from. Fine for product feedback. Not for proof.

---

## 1. Housekeeping — small, on Ben's side

- ~~Decide the Premium price~~ — **DECIDED: $24.99/mo.** 120 voice minutes included
  is roughly $9.60 of compute at ~$0.08/min, so $24.99 holds a real margin where
  $19 wouldn't. Nothing blocking the pricing page now.
- Raise the Supabase auth email rate limit above 30/hour before any traffic push.
- Confirm minimum password length is 8 or lower (the UI enforces 8).
- Delete the leftover test accounts via Authentication → Users, never by deleting
  the `profiles` row — that leaves an orphan in `auth.users` that can still sign in.

---

## 2. ~~Pricing page~~ — SHIPPED 27 July

Live at `/pricing`, eighth indexed page. Two columns (Free, Standard), nine rows,
outcome-phrased labels, `table` block type added to the generator.

**Premium is deliberately absent from the live page.** Ben's call: hide it until all
its features exist. A tier you can read about but not buy invites "when?" with no
good answer, and gives somebody a reason to wait instead of taking Standard today.

**MODEL CHANGED 27 July — no permanent free tier.** Completely free for everyone
during beta (to 15 Nov), then a **7-day free trial**, then $14.99/mo or $119/yr.
Founding $7.99/mo grandfathered for the beta cohort. Premium $24.99 when it opens.

Why: frontline managers use this episodically, 2–3x/week. A free tier at 100
points/day handed a ten-session-a-month user a ninety-session allowance — they'd
never hit the ceiling, never feel constrained, never pay. Daily limits don't bite on
episodic users.

**Stripe "Trials" stays empty.** The 7 days is gated in-app; Stripe is touched only
at purchase. A card wall at signup would kill cold search traffic, which is the
whole point of the eight content pages.

### Open consequence — the credits pill has no audience

It was built to show a free tier's daily allowance. Under the new model beta users
are unlimited, trial users get full access, and paid users get fair-use — nobody
should see a 0–100 daily meter. Either hide it or repurpose the same header slot to
show **trial days remaining**, which is the more useful number now. The metering
*recording* stays valuable either way; it's still gathering real cost data. Decide
before the trial ships.

---

## 3. Premium tier — the next real build

Full spec in **`docs/spec-premium-tier.md`**. The split, as a sentence:

> **Standard helps you with today's conversation. Premium helps you run a team over
> time.**

Five features, and **four of them are buildable right now on data the app already
writes and never reads.** Only voice is blocked behind billing and November.

**Build order:**

1. **Follow-through tracker** — every tool already writes a `followUp` / `nextSteps`
   field with a date and nothing surfaces them. Cheapest to build, highest retention
   value, and it's the feature that makes a supervisor look competent to their own
   boss.
2. **Team roster** — explicit list of your people. Free/Standard 3, Premium
   unlimited. Not a takeaway; no roster exists today.
3. **1:1 Prep** — the headline. One tap on a name produces a prep card from every
   logged conversation about them. Every input already exists:
   `getEmployeeHistory()`, the stored `agreement` and `followUpPlan` fields,
   `getLatestMemory()`, session dates. The compounding mechanic is the opening
   block — *"On 12 July you agreed X. Has that held? [Yes / Partly / No]"* — one tap
   that feeds the next card.
4. **Deeper history** — `getEmployeeHistory()` returns 2 for everyone today; Premium
   gets 6. One-line default change.
5. **Voice** — 120 min/mo, gated behind billing. The expensive one.

**Worth deciding:** whether Premium opens on 1–4 at a lower price with voice raising
it later, rather than holding the whole tier hostage to the hardest feature.

**Hard rule:** Premium may only contain NEW capability. Nothing in Free or Standard
moves up. Per-employee memory is already live for everyone and the pricing page
promises it in both tiers — Premium extends the depth, it doesn't introduce the idea.

---

## 4. Content — the wedge nobody else occupies

**~~Healthcare as an eighth industry~~ — SHIPPED 27 July.** `world` block written
with an extra SCOPE LIMIT the other seven don't need: coach the manager on managing
people, never give clinical guidance, triage advice or an opinion on a medical
decision; if the real problem is clinical or patient-safety, say so and point at
clinical leadership. It's the one industry where a coaching app could wander
somewhere genuinely dangerous.

**~~Industries section on the landing page~~ — SHIPPED 27 July.** Eight cards with
the orange glow on hover, from `src/lib/industryCards.js`. Deliberately shows
SITUATIONS ("Charting finished late, every shift") rather than KPIs the way North
does — Frontline Coach tracks no metrics, so KPI chips would promise analytics that
don't exist, and situations are the thing North structurally can't copy.

**Per-industry public pages — still to do.** The landing section shows breadth; this
is eight dedicated pages, one per setting, targeting "restaurant manager difficult
conversation" style queries. `INDUSTRIES` in `App.jsx` already holds the vocabulary
for all eight and `industryCards.js` holds the marketing copy, so both halves exist —
this is assembling them into pages through `gen-pages.mjs`.

> **RESOLVED 2026-07-27.** The rule is "don't tie this product to my employer,"
> not "never mention the industry." Car wash ships as one of eight settings on the
> landing page. What stays out: the employer's name, any description that
> identifies them, and the domain literal (already stripped from the client
> bundle). Industry pages can therefore cover all eight.

**Generational pages.** `GENERATIONS` in `App.jsx` covers Gen Z, Millennial, Gen X,
Boomer, Gen Alpha. **None of the four competitors has anything comparable.** "How
do I coach a Gen Z employee" is high-volume, high-intent, badly served, and nobody
has a product attached to it. Higher leverage than another conversation-type page
because there's no competitor on the query.

> **RESOLVED 2026-07-27.** The "glowing orange industry examples" request meant the
> landing-page section modelled on North's — built and shipped the same day.

---

## 5. Product — user-requested and competitively relevant

**Step-by-step conversation guidance.** Ben's own Team Leads asked for it — *"guide
the conversation one step at a time instead of providing everything at once."*
North shipped it as Coaching Playbooks. Requested by real users AND a known
competitive gap, which puts it above anything speculative. Note the Conversation
Builder already has a "Guided" view; this may be extending that rather than
building new.

**Team Pulse, with expiry.** Premium candidate, but after the first Premium
release — it needs a Terms and Privacy update. Ben liked North's. It's cheap here —
`employeeMemory.js` already stores employee names keyed per user, so a pulse read
ships as a new session type with **zero migrations**. But it reverses a deliberate
design choice; the comment on line 14 of that file reads *"not a permanent growing
dossier,"* and pulse is exactly that. Proposed compromise: log the read, surface a
flag on two consecutive same-colour reads, **roll the data off after 8–12 weeks.**
Long enough for the pattern, short enough that it isn't a performance file. Needs
a Terms and Privacy update in the same release, and a cleanup job — the
`synthesize-memory` cron is the place to put it.

**PII scrubbing.** TACT strips names, companies, emails and phone numbers in the
browser before anything reaches the model. Frontline Coach handles the same risk in
the Terms by asking users not to enter it. Note that `employeeMemory.js` already
stores employee names by design, so this isn't hypothetical. Build it before any
employer-bought B2B motion — it's the first question a buyer's legal team asks.

---

## 6. Dated — 15 November 2026, beta closes

- Flip `METERING_ENFORCE=true` in Netlify env. Recording has run since 27 July; two
  months of real per-user cost data should replace the estimates in `credits.js`
  before enforcement starts.
- Fire the founding-price banner and email. **Banner copy is written; the matching
  email is not.** Worth a scheduled reminder a few days ahead.
- Set the beta cohort onto the $7.99/mo grandfathered price. Note: the Stripe
  product may have been built as a one-time purchase — the decision changed to
  recurring, so verify before Nov 15.

---

## 7. Deferred, deliberately

**Voice.** Two of four competitors have it, so it moved from differentiator to
table stakes — but it's gated behind billing for cost reasons (realtime voice
breaks a $0.25/day free tier). Sequence: billing live → voice on Premium → free
first session as the taste, because the conversion moment is *experiencing* voice,
not reading about it. Don't chase it before Nov 15.

**Desktop layout.** The app is `max-w-md` centred, same view on desktop as mobile.
Leave it. That's a deliberate constraint matching a supervisor holding a phone on a
floor, the landing page already goes responsive to `lg:max-w-3xl`, and widening the
app is real work for a use case with no supporting evidence. Revisit when analytics
land in Phase 4.

**ChatGPT plugin.** Revisit once voice, saved coaching context and roleplay scoring
history exist — that's the "capability ChatGPT lacks natively" bar OpenAI wants.

**Fold `gen-legal-html.mjs` into `gen-pages.mjs`.** Two templates now exist for what
should be one. No user impact, but it will drift. Low priority — the legal pages are
tied to Google's OAuth verification and weren't worth destabilising for tidiness.

**Don't do:** match North's feature breadth (twelve features, unwinnable race), add
TACT's employee seat (different product, different person), build a daily huddle
generator (North's wedge, pulls away from conversation quality), or broaden the
audience — North including engineering managers is a weakness to exploit, not a
model to copy.

---

## Reference

- `docs/competitor-landscape.md` — four competitors, pricing, the two real problems
- `docs/competitor-north.md` — the direct competitor
- `docs/competitor-peopling.md` — closest on roleplay, plus the voice reasoning
- `docs/real-usage-analysis.md` — what 15 real submissions say about topic choice
- `docs/proof-layer-draft.md` — pilot findings, and why they can't be quotes
- `docs/EMAIL-SETUP.md` — Resend runbook
- `CONTENT-PLAN.md` — the seven pages, target queries, what shipped
- `docs/operator-page-draft.md` — full drafting history and every decision
