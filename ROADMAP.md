# Roadmap — pick up here

Last updated end of 27 July 2026. Supersedes `docs/ROADMAP.md`, which was written
earlier the same day and predates the metering build and the Nov 15 pricing
decision.

Ordered by leverage. The first item is the only one that changes anything.

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

## 2. Pricing page

Unblocked. Build through `gen-pages.mjs` like every other page — eighth indexed
page, and pricing queries are further down the funnel than advice queries.

Include the plan comparison table. Ben's read on North's version was right: a
pricing card is a list of claims, a table is a decision aid. Two things to copy
exactly — row labels that describe outcomes ("Spot disengagement early") rather
than feature names, and real checkmarks in the free column. One thing to do
differently: North has thirteen rows and past about eight a comparison table stops
being a decision aid and becomes an inventory.

Needs a new `table` block type in the generator.

**Tier structure as it stands:**

| | Free | Founding $7.99 | Standard $14.99 | Premium $24.99 |
|---|---|---|---|---|
| Daily credits | 100 pts | Standard ceiling | 1,200 pts fair-use | 2,400 pts |
| Voice | — | — | — | 120 min/mo |

Annual on Standard is $119 (~$9.92/mo effective, "save $61"). Premium annual not
yet priced — the obvious parallel is ~$199, but decide it against real voice usage
rather than by analogy.

The $10 gap between Standard and Premium is wide enough that Standard is a genuine
choice rather than a decoy, which is what $19 would have made it.

Founding is a **grandfathered monthly rate for the beta cohort**, locked while they
stay subscribed — not a one-time lifetime purchase. Be explicit on the page that
Founding locks the *Standard* price and Premium is separate, or founding members
will feel cheated when voice lands behind a higher tier.

---

## 3. Content — the wedge nobody else occupies

**Healthcare as an eighth industry.** North covers it, we don't. Clinic and
hospital supervisors are a large frontline audience with exactly these problems.
Small job — one `world` block in `INDUSTRIES` matching the pattern of the other
seven.

**Per-industry public pages.** North's strongest content play and we're 80% built
for it already: `INDUSTRIES` in `App.jsx` has general, carwash, restaurant, retail,
warehouse, hospitality, fieldservice — each with its own `world` vocabulary and
`examples`. That's the hard part, done and shipped, just not public. Six pages
available without touching the car wash question.

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

**NEEDS CLARIFICATION — per-industry examples with the glow.** Ben asked for
"voice for every industry examples like they do but in our own way, the cool
glowing orange." Two readings: (a) industry-specific example prompts on the public
pages, styled with the orange glow treatment used on the credits pill, or (b)
something about voice mode per industry. Ask before building.

---

## 4. Product — user-requested and competitively relevant

**Step-by-step conversation guidance.** Ben's own Team Leads asked for it — *"guide
the conversation one step at a time instead of providing everything at once."*
North shipped it as Coaching Playbooks. Requested by real users AND a known
competitive gap, which puts it above anything speculative. Note the Conversation
Builder already has a "Guided" view; this may be extending that rather than
building new.

**Team Pulse, with expiry.** Ben liked North's. It's cheap here —
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

## 5. Dated — 15 November 2026, beta closes

- Flip `METERING_ENFORCE=true` in Netlify env. Recording has run since 27 July; two
  months of real per-user cost data should replace the estimates in `credits.js`
  before enforcement starts.
- Fire the founding-price banner and email. **Banner copy is written; the matching
  email is not.** Worth a scheduled reminder a few days ahead.
- Set the beta cohort onto the $7.99/mo grandfathered price. Note: the Stripe
  product may have been built as a one-time purchase — the decision changed to
  recurring, so verify before Nov 15.

---

## 6. Deferred, deliberately

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
