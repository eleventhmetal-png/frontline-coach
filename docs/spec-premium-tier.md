# Spec — Premium tier and 1:1 Prep

Written 27 July 2026. Not built. Premium doesn't open until voice ships.

## The problem this solves

Standard $14.99 and Premium $24.99 currently differ by one thing: voice. That's a
thin justification for a $10 gap, and it makes Premium read as "Standard plus an
add-on" rather than a different product.

## The split, stated as a sentence

> **Standard helps you with today's conversation. Premium helps you run a team over
> time.**

Everything below follows from that. Standard is a supervisor reaching for help when
something happens. Premium is a supervisor managing eight people across weeks —
history, preparation, follow-through, and the ability to rehearse out loud.

That's a real distinction a buyer can feel, and it maps to genuinely different
usage: the Premium features all depend on accumulated data, which only exists for
somebody using the app regularly. They're power-user features by nature, not
arbitrary gates.

## Rule: Premium may only contain NEW capability

Nothing currently in Free or Standard moves up. Users punish takeaways harder than
price rises, and the pricing page already promises per-employee memory in all three
tiers — that promise stands.

Specifically: `employeeMemory.js` already recalls the last two conversations per
person for everyone. **That stays.** Premium extends the depth, it doesn't
introduce the concept.

---

## Feature 1 — 1:1 Prep (the headline)

The one Ben named, and the strongest of the set because it's the only feature that
gets *better the longer you use the product*.

### What it does

You have a one-on-one with someone in twenty minutes. One tap on their name
produces a prep card built from every conversation you've logged about them.

### What it pulls

All of this already exists in the database:

- `getEmployeeHistory()` — prior Conversation Builder sessions for that person
- The `agreement` and `followUpPlan` fields already stored in every session output
- `getLatestMemory()` — the manager's own pattern from Practice reps
- Session dates, for "you said you'd check in two weeks ago"

Nothing new has to be captured. The data is sitting there unused.

### Output shape

Deliberately reuses the vocabulary the other tools already use (`opening`,
`howToDeliver`, `watchFor`, `agreement`) so it reads as native rather than bolted on.

```
SINCE LAST TIME      On 12 July you agreed she'd have the closing
                     checklist done every shift. Has that held?
                     [Yes / Partly / No]

WHERE THEY STAND     Three conversations in six weeks, all about the
                     same thing. The pattern is follow-through, not
                     capability.

COVER THESE THREE    1. The checklist, and whether the last fix stuck
                     2. She's covering Marcus's close twice a week —
                        acknowledge it
                     3. What she wants next; she's asked twice

OPEN WITH            "Before anything else — you've covered Marcus
                     twice this week and I noticed. Thank you."

WATCH FOR            She goes quiet when she disagrees rather than
                     pushing back. Silence isn't agreement here.

LAND ON              One specific commitment with a date, not a
                     general 'I'll do better'.

DON'T                Don't open with the checklist. Third time in a
                     row and it becomes the only thing you talk about.
```

The `[Yes / Partly / No]` on the first block is the important bit: it's a
one-tap answer that feeds the *next* prep card. That's the loop that makes this
compound instead of just summarising.

### Why it's Premium

It's worthless on day one and valuable on day ninety. Somebody who's logged three
conversations about one person gets a genuinely useful card; somebody who just
signed up gets an empty one. Gating it protects the first impression as much as the
margin.

Cost: one Sonnet call over accumulated context, roughly a Coach call — about 11
points. Not the expensive part of Premium.

---

## Feature 2 — Team roster

An explicit list of the people you lead, rather than names inferred from
conversation history.

- **Free / Standard:** 3 people
- **Premium:** unlimited

Honest gate — more people tracked means more context and more tokens. It's also the
standard mechanic in this category (North caps free at 2), which means buyers
already understand it.

Enables 1:1 Prep to have a home: a list of your people, each with "last talked N
days ago" and a Prep button.

**Not a takeaway:** there is no roster feature today, so nothing is being removed.
Employees are currently implicit from conversation history and stay that way on
Free.

---

## Feature 3 — Follow-through tracker

Every tool already generates a `followUp` or `nextSteps` field with a date. Nothing
surfaces them. They're written to the database and never seen again.

Premium collects them into one list: what you committed to, for whom, by when, and
whether it's overdue.

This is the cheapest feature on the list to build — the data exists, it just needs a
query and a screen — and it's the one most likely to make somebody keep paying,
because it's the thing that makes them look competent to their own boss.

Pairs directly with 1:1 Prep: an overdue commitment is exactly what the prep card
should lead with.

---

## Feature 4 — Deeper history

`getEmployeeHistory()` currently returns the last 2 conversations for everyone.

- **Free / Standard:** 2 (unchanged)
- **Premium:** 6, and 1:1 Prep sees all of them

Real cost dimension (more context tokens per call) and real value dimension (better
pattern recognition). One-line change to a default argument.

---

## Feature 5 — Voice

Already specced. 120 minutes a month, roughly $9.60 of compute at ~$0.08/min, which
is what makes $24.99 hold a margin where $19 wouldn't.

First session free even on Standard, as the taste — the conversion moment for voice
is experiencing it, not reading about it.

---

## Feature 6 — Team Pulse (later)

Specced in `ROADMAP.md` with the 8–12 week expiry design. Fits Premium's "run a team
over time" story cleanly, but it needs a Terms and Privacy update, so it shouldn't
be in the first Premium release.

---

## Revised comparison table

Do NOT put this on the live pricing page until the features exist. Listing five
unbuilt Premium features invites "when?" questions with no good answer. The current
page correctly shows Premium as voice-only and in development.

| | Free | Standard | Premium |
|---|---|---|---|
| Monthly | $0 | $14.99 | $24.99 |
| Coaching sessions a day | ~3 | Unlimited | Unlimited |
| Rehearse against an AI employee | 2/day | Unlimited | Unlimited |
| Remembers who you've coached | Last 2 | Last 2 | Last 6 |
| People on your roster | — | 3 | Unlimited |
| **One-tap 1:1 prep** | no | no | yes |
| **What you committed to, tracked** | no | no | yes |
| **Practise out loud** | no | no | 120 min/mo |
| Every coaching tool | yes | yes | yes |

Nine rows. Past about eight a comparison table stops being a decision aid and
becomes an inventory — North's has thirteen.

---

## Build order when Premium opens

1. **Follow-through tracker** — data already exists, cheapest, highest retention value
2. **Team roster** — needed as the home for prep
3. **1:1 Prep** — the headline, depends on 1 and 2
4. **Deeper history** — one-line change, ship alongside prep
5. **Voice** — the expensive one, gates the tier opening
6. **Team Pulse** — after, with the Terms update

Items 1–4 are all buildable now on existing data. Only voice is blocked. Worth
considering whether Premium opens on 1–4 at a lower price and voice raises it later,
rather than holding the whole tier hostage to the hardest feature.
