# Competitive landscape — AI coaching for workplace conversations

Assembled 2026-07-27. Individual deep-dives: `competitor-north.md`,
`competitor-peopling.md`. This is the synthesis and the strategic conclusions.

## The four

| Product | Audience | Core model | Pricing | Traction signal |
|---|---|---|---|---|
| **frontline.coach** | Sales & CX reps | Voice roleplay, methodologies | Paid tiers | 20+ indexed pages, real content op |
| **Peopling** (peopling.app) | Tech/knowledge managers | Voice roleplay only | Free + paid | PH #8, 178 followers |
| **North** (northcoach.net) | Frontline *and* mid-level mgrs | Broad platform, 12+ features | $15 / $19 per user | Paid ads, 12+ pages, blog |
| **TACT** (tacttalk.org) | Corporate / exec, both seats | 5-part scripts + roleplay | $9.99 / $19.99 | **6 signups, self-published** |

## TACT — the notable details

Built by ST4Y READY, a leadership advisory selling to Fortune 500 execs, founders and
non-profit boards. TACT is the productised version of their consulting, with a "book a
consultant" upsell when stakes get legal or career-defining. Real business model.

Built on Lovable — the OG image URL still points at a `lovable.app` preview domain.

**Serves both seats.** Manager scripts (feedback, insubordination, PIPs, terminations)
*and* employee scripts (asking for a raise, managing up, setting boundaries, filing an
HR complaint). Nobody else does the employee side.

**Two things they do that are genuinely smart:**

1. **Local PII scrubbing.** Names, companies, emails and phone numbers are stripped in
   the browser before anything reaches the model. Frontline Coach currently handles this
   same risk in the *Terms of Service* — asking users not to enter employee names. TACT
   solved it with engineering instead of legalese, and for a product with a documentation
   feature that's a meaningful trust gap.
2. **Free tools with no signup at all.** Tone checker, self-talk reframe, and a live
   conversation simulator — all usable on the marketing page without an account. Two uses
   per day, then a wall.

**Where they're not a threat:** the audience is white-collar. Raises, turf wars, managing
up, HR complaints, PIPs. Nothing about shifts, floors, attendance, crews or hourly work.
Their hero images are executives in glass offices.

**Admirably honest about proof.** Their testimonial section says outright: *"Real quotes
from real users will live here — once they've earned them."* And they publish live
counters: **6 leaders signed up, 9 situations scripted, 6 scripts saved.** That's more
integrity than North's initials-only testimonials, and it's a useful reality check.

## Five conclusions

### 1. The category is filling fast, but nobody owns the hourly floor

Four products in roughly six months. Three of them serve office workers. North claims
frontline but includes engineering managers, sprint velocity and MTTR — their own demo
shows a performance conversation about missed sprints and story points.

**Nobody is exclusively about hourly frontline supervision.** That remains the only
defensible position available, and it's the one Frontline Coach already occupies. The
risk isn't losing it — it's failing to make it obvious within five seconds of landing.

### 2. Frontline Coach is not behind on traction

TACT publishes 6 signups. Peopling has 178 PH followers of unknown activity. North shows
no user numbers at all.

Frontline Coach has 7 pilot users, 15 logged tool uses from 9 unique IPs over a month,
and a written multi-user pilot report from a General Manager. That is a real usage
dataset, and it's arguably the strongest evidence base of the four. The gap is external
*visibility*, not usage.

### 3. The market prices at $10–20/month

- TACT: $9.99 Pro, $19.99 Leadership Pro
- North: $15 Pro, $19 Team per user

My earlier estimate that a personally-paying frontline supervisor caps out in single
digits was too low. Two competitors are pricing this buyer at $10–20. Whether they
convert is unknown, but the anchor exists.

**Roleplay is the premium tier at TACT** — AI roleplay practice sits in the $19.99 tier,
not the $9.99 one. That independently validates gating voice/rehearsal behind paid.

### 4. The biggest problem isn't the product — it's what happens after the click

Seven content pages now drive traffic to a landing page whose only action is signing up
for a **closed beta**. Somebody arriving from a search for "employee said that's not my
job" reads a genuinely useful page, clicks through, and hits a wall.

TACT's counter-model is instructive: three tools usable with no account at all. Try the
simulator, check a message's tone, get a reframe — then a limit, then a signup.

This is the highest-leverage thing on the list. Options, roughly in order of effort:

- Open the beta gate. Thirty slots, zero used, and the content is now live.
- Ship one no-signup tool on a public page. A tone checker or a single-turn "what do I
  say" that runs a few times per IP per day, then asks for an account.
- At minimum, make the waitlist the visible default rather than a fallback that only
  appears after somebody clicks Sign Up and discovers it's closed.

### 5. PII scrubbing is a real gap, not a nice-to-have

Frontline Coach's Terms ask users to avoid entering employee names, medical details and
sensitive information. That's a contractual mitigation for a technical problem. TACT
scrubs client-side before the model sees anything.

For a product whose Documentation Assistant explicitly handles records about named
employees, this is the kind of gap a cautious buyer — or an employer buying seats — will
ask about. Worth building before any B2B motion.

## What not to do

**Don't match feature lists.** North has twelve features and shipped voice. TACT has six
tools and two free ones. Frontline Coach will not win a breadth race and shouldn't enter
one.

**Don't add the employee seat.** TACT's raise-negotiation and HR-complaint scripts are a
different product for a different person. Adding them dilutes the one thing that's clear.

**Don't broaden the audience.** North's inclusion of engineering managers is a weakness
to exploit, not a model to copy.

## What Frontline Coach actually has

Ranked by how hard it would be for any of the four to copy:

1. **A named operator with eighteen years on the floor, a Navy carrier, and a specific
   story about the person whose job he cost.** North is an anonymous Danish registration.
   TACT is a consultancy's brand voice. Peopling is a tech coach. None of them can
   manufacture this.
2. **Exclusive focus on hourly frontline supervision.** Attendance, floor pushback, a
   standard slipping across a crew, documentation. Not raises, not scope creep, not
   sprints.
3. **Rehearsal against a resisting AI employee.** North doesn't have it at all. TACT gates
   it at $19.99. Peopling has it but for office scenarios.
4. **Real usage evidence** from actual frontline supervisors, with the criticism addressed
   and shipped.

The strategy is unchanged, just sharper: narrow, credible, and obvious about it.
