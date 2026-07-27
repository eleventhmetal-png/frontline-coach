# Roadmap — post-competitive-research

Assembled 2026-07-27 after mapping North, TACT, Peopling and frontline.coach. See
`docs/competitor-landscape.md` for the analysis this comes from.

Ordered by leverage, not by how interesting it is to build.

---

## 0. The conversion wall (unchanged, still first)

Seven content pages now drive traffic to a landing page whose only action is joining a
**closed beta**. Nothing below matters until somebody who arrives can actually use the
thing.

Cheapest to most: open the gate (30 slots, 0 used) → make the waitlist the visible
default instead of a fallback → ship one no-signup public tool the way TACT does.

---

## 1. Per-industry pages — "coaching that speaks your language"

North's strongest content play, and Frontline Coach is already built for it.

**What already exists in `App.jsx` (`INDUSTRIES`):** general, carwash, restaurant,
retail, warehouse, hospitality, fieldservice. Each has a `world` description and
`examples`. That's the hard part — the vocabulary is written and shipped, it just isn't
public.

**Six pages available immediately without touching the car wash question:**
`/for/restaurant`, `/for/retail`, `/for/warehouse`, `/for/hospitality`,
`/for/field-service`, `/for/general`. Parity with North's six.

Each page: the conversations that actually happen in that setting, the vocabulary, two
or three real scenarios, and an FAQ in that industry's language. Same generator, same
block types, no new infrastructure.

**Open question for Ben:** the constraint was "nothing about car wash." Including car
wash as one of seven industries a product supports doesn't identify an employer — retail
and hospitality don't identify one either. Worth deciding whether the rule was "no car
wash anywhere" or "don't tie this product to my employer." The second is satisfiable
with a car wash page; the first isn't. Ben's call, and there's no downside to skipping it
— six is enough.

## 2. Generational layers — nobody else has this

`App.jsx` also has generational coaching layers: Gen Z, Millennial, Gen X, Baby Boomer,
Gen Alpha. **None of the four competitors has anything comparable.**

"How do I coach a Gen Z employee" and "managing Gen Z workers" are high-volume,
high-intent queries with a lot of bad content behind them and no product attached. This
is an uncontested content lane that's already built into the product.

Candidate pages: `/coaching-gen-z-employees`, `/managing-across-generations`.

Higher leverage than another conversation-type page, because there's no competitor
sitting on the query.

## 3. Voice

Two of four competitors have it. North shipped it with exactly the frontline argument —
*"no typing needed, perfect for on-the-go."*

Moved from differentiator to table stakes. Still gated behind billing for cost reasons
(realtime voice breaks a $0.25/day free tier). Sequence: billing → voice on paid → free
first session as the taste. See `competitor-peopling.md` for the reasoning.

## 4. Step-by-step conversation guidance

Ben's own Team Leads asked for this: *"guide the conversation one step at a time instead
of providing everything at once."* North shipped it as Coaching Playbooks.

Requested by real users **and** now a known competitive gap. That combination puts it
above anything speculative.

## 5. Team Pulse

Ben liked North's version. It's good, and it's cheap here — but it carries a real
decision.

**What's already built.** `src/lib/employeeMemory.js` stores employee names in
`sessions.input.name`, dedupes by normalised name, scopes everything to `user_id`, and
`getCoachedEmployees()` already powers quick-pick chips of who you've coached. A pulse
read ships as a new session type — `tool: "pulse"`, `input: {name, dimension, rating}` —
with **zero migrations**, reusing the working pattern.

**What makes it good** (worth being precise, because the traffic-light UI is not the
point):

- It's a manager's private read, explicitly not an employee survey. North says so on
  their own page.
- It converts a vague feeling into a dated data point. Same principle as the
  documentation page: "she seems off" is a feeling, "yellow two weeks running" is a
  record.
- It surfaces itself. Two consecutive yellows and the app raises it next time you open —
  the manager doesn't have to remember to look.

**The decision it forces.** From the comment on line 14 of `employeeMemory.js`:

> *Deliberately kept light: we recall the most recent one or two conversations, not a
> permanent growing dossier.*

Pulse is a permanent growing dossier. You cannot get the "two yellows running" value
without accumulating a series. That reverses a deliberate design choice, and it has two
consequences: the Terms currently ask users to minimise what they enter about employees,
and a retained series of a supervisor's private performance judgments about an
identifiable person is the kind of record that gets requested in a dispute.

**Proposed design — pulse with expiry.**

- New session type, no migration.
- Manager logs green/yellow/red on a small number of self-chosen dimensions after a
  conversation. Thirty seconds.
- Surfacing: two consecutive same-colour reads on one person raises an attention item.
- **Retention: roll off after 8–12 weeks.** Long enough for the pattern, short enough
  that it isn't a performance file. Requires a scheduled cleanup job — the
  `synthesize-memory` function already runs on cron, so there's a place to put it.
- Terms and Privacy Policy updated in the same release, not after.

That retention answer is also a better story than North's when a B2B buyer asks what you
keep.

## 6. PII scrubbing

TACT strips names, companies, emails and phone numbers **in the browser** before anything
reaches the model. Frontline Coach handles the same risk in the Terms of Service by
asking users not to enter that information.

Note the tension with everything above: `employeeMemory.js` already stores employee names
by design, and pulse would extend that. So this isn't hypothetical — it's the current
state. Worth solving with engineering before any employer-bought B2B motion, because it's
the first question a buyer's legal team asks.

---

## Pricing — decide the shape now, the number later

**Market anchors:**

| | Free | Mid | Top |
|---|---|---|---|
| TACT | 3 scripts/mo | $9.99 unlimited | $19.99 (adds AI roleplay) |
| North | 15 msgs/day, 2 people | $15 ($12 annual) | $19/user (team) |

Ben's read: price similar to North, since they offer more. **Two problems with that
frame.**

**Their pricing isn't validated.** North publishes no user numbers. TACT publishes six
signups. Copying the price of a pre-traction competitor is copying a guess, not
importing evidence.

**Matching price while offering less loses a checklist comparison.** If a buyer lines up
feature lists at the same price, Frontline Coach loses — North has twelve features. The
only way $15 works is if the buyer isn't comparing lists, which means the page has to
make the narrowness obviously *deliberate* rather than incomplete.

**What to actually do:**

- **Decide the shape now.** Free tier that stays genuinely useful, because the whole
  content strategy converts into it — cripple it and seven pages stop working. One paid
  tier anchored on **voice plus unlimited rehearsal**, which is exactly where TACT put
  roleplay ($19.99, not $9.99). That validates the structure independently.
- **Decide the number with real users.** Land around $12–15 as a working assumption, but
  don't commit publicly until ten external supervisors have used it and been asked. That
  conversation is worth more than either competitor's price page.
- **Remember who pays.** A shift lead buying personally has a different ceiling than a
  manager expensing it. If it's employer-bought, that's a B2B motion and it pulls in the
  MSA and DPA work already sitting in Phase 4.

### Build the feature comparison table

Ben's observation: North's plan-comparison table makes it instantly clear what you get at
each tier. He's right, and it's worth copying the *format* even though the content will
differ.

Why it works: a pricing card is a list of claims, a comparison table is a decision aid.
Somebody scanning three columns can locate themselves in about four seconds without
reading a word of marketing copy. It also pre-empts the "what am I missing" anxiety that
kills upgrades.

Two things to steal specifically:

- **Plain-language row labels.** North writes "Track every 1-on-1 conversation" and
  "Spot disengagement early" rather than feature names. The row describes the outcome, so
  a reader who's never used the product still knows what it means. Compare that to a row
  labelled "Skill vs. Will Diagnostic," which means nothing until you've used it.
- **Show the free tier honestly.** Their free column has real checkmarks in it. A
  comparison table where free looks worthless reads as a bait-and-switch and makes people
  distrust the paid column too.

One thing to do differently: **North's table has thirteen rows and it's too many.** Past
about eight, a comparison table stops being a decision aid and becomes an inventory. Pick
the rows that actually differentiate the tiers and drop the ones that are checked
everywhere.

Where it goes: a `/pricing` page, built through `gen-pages.mjs` like everything else. That
also adds an eighth indexed page targeting "frontline coach pricing" and comparison
queries, which is a real search intent — people looking for pricing are further down the
funnel than people looking for advice.

Needs a new `table` block type in the generator. Small, and reusable for any future
comparison.

---

## Explicitly not doing

- **Matching feature breadth.** North has twelve features. That race is unwinnable and
  entering it abandons the only clear position.
- **The employee seat.** TACT's raise-negotiation and HR-complaint scripts are a
  different product for a different person.
- **Daily huddle generator.** Good feature, but it's North's wedge and it pulls away from
  conversation quality.
- **Broadening the audience.** North including engineering managers is a weakness to
  exploit, not a model to copy.
