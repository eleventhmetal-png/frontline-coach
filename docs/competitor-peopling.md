# Competitor — Peopling (peopling.app)

Researched 2026-07-27. Sources: Product Hunt listing and launch thread.

## What it is

AI-powered **voice** roleplay for difficult workplace conversations. Solo-built by
Kent Wills, a coach whose background is engineers and managers at Stripe, Netflix,
Roblox and Headspace. Launched around April 2026, hit #8 day rank on Product Hunt with
144 points, 178 followers.

Positioning line: *"Most managers learn to have hard conversations by having them
badly. Peopling gives you a private space to practice."*

Features from the launch thread:

- Voice-to-voice roleplay with dynamic, unscripted responses. The agent cedes ground
  if you're handling it well and gets harder if you aren't.
- Pre-built personas per scenario, plus custom personas and custom scenarios.
- Coach feedback via "evaluators" (he mentions a negotiator evaluator).
- Runs evals to check the agent adheres to his coaching principles.
- Free tier. Auth via LinkedIn and GitHub, Google being added.

## Where it genuinely overlaps

One page: `/manager-roleplay`. Rehearsing a conversation against AI resistance is the
same core idea, and their execution has a real advantage — **voice**. Speaking a hard
conversation out loud is better practice than typing it, and they're built around that.
That's an honest edge on this specific use case.

## Where it doesn't overlap — and this is the bigger half

**Different worker entirely.** Their scenarios are "giving hard feedback," "managing
up," "pushing back on scope creep." That last one is knowledge-work vocabulary. Nobody
running a floor at 6am on a Saturday is pushing back on scope creep. The founder's
credibility is coaching at Stripe and Netflix — which is real credibility, aimed at
somebody who is not a shift lead.

**The auth wall proves it.** LinkedIn and GitHub only. A commenter on his own launch
flagged this as a drop-off problem and he agreed. A team lead at an hourly operation
does not have a GitHub account and may not have a LinkedIn. That signup screen is built
for software people, and it's a decision about who the product is for whether or not
it's intended as one.

**Single feature vs six.** Peopling is rehearsal. Frontline Coach does rehearsal as one
of six tools, and the other five are the ones a supervisor needs mid-shift:

- In-the-moment pushback words while somebody is standing in front of you. Peopling
  can't help during the conversation, only before it.
- Documentation — turning what happened into a factual record. Not in their product at
  all, and it's the highest-trust query set in `CONTENT-PLAN.md`.
- Skill vs. Will diagnosis, conversation planning, cross-conversation memory.

**Opposite credibility play.** Theirs is "coach to elite tech companies." Ben's is
"operator who ran shifts and got it wrong for eighteen years." For a frontline
supervisor, the Stripe pedigree may actively read as *not for me*.

## What they're beating us at, and it isn't the product

They have a Product Hunt launch: an inbound link from a high-authority domain, 178
followers, a 23-comment forum thread, a reviews page, and the founder publicly asking
users which scenarios to build next.

That is precisely the external corroboration Frontline Coach has none of. They are
three months ahead on distribution while being behind on scope.

**The lesson is copyable and legitimate.** A Product Hunt launch is a real path to the
external links and third-party mentions listed as the biggest remaining gap in
`CONTENT-PLAN.md`. It costs nothing but preparation.

## Voice — corrected position (2026-07-27)

My first read was "don't chase voice." Ben pushed back and he's right. Revised:

**Voice matters MORE for this audience than for Peopling's, not less.** A software
manager rehearsing at a desk types comfortably. A shift lead does not. They're on a
floor, hands busy or dirty, phone in a pocket, five minutes in a break room. Talking is
available to them when typing isn't. Text-based rehearsal is a worse fit for frontline
supervision than it is for knowledge work — which means voice is closer to a
requirement here than it is for the competitor who already has it.

That inverts the original analysis. Voice isn't a me-too feature to be resisted; it's
arguably the single biggest product gap.

**The caution that survives is sequencing and cost, not strategy.** Realtime voice runs
meaningfully more expensive per minute than text. The current free tier is already
budget-constrained (~$0.25/day, roleplay subsidised to 3 sessions/day), and voice would
break that immediately. So voice is a paid-tier feature, which puts it downstream of the
Phase 4 billing work rather than ahead of it.

**Sequence:** billing → voice on paid → then it's a differentiator rather than a cost
problem. Attempting it on the free tier first is the version that fails.

### Voice as the paid anchor (Ben's call, 2026-07-27)

Ben's read: paid-only voice is a good selling point. Agreed, and for a better reason
than most upgrade triggers — the value is legible. "Practise out loud" needs no
explanation, unlike "more messages" or "a better model." It's also an honest paywall:
voice actually costs money per minute, so it isn't artificial scarcity around something
free to serve. That distinction affects how people feel about paying.

**Give a taste before the wall.** The conversion moment for voice is experiencing it,
not reading about it. Somebody who has never spoken to an AI employee doesn't know they
want to — it sounds gimmicky until the thing pushes back out loud. First session free,
then paid. Costs one session of API spend per user and converts far better than
paid-from-zero.

**Voice shouldn't be the entire paid tier.** One feature is a thin subscription. Voice
as the headline, bundled with higher daily limits and more roleplay sessions, is a real
tier — and those also cost money, so the pricing stays honest.

**Price ceiling is set by who pays.** Frontline supervisors often buy personally rather
than on a company card, which is a lower ceiling than a tech manager expensing $40/mo.
Personal probably means single digits. More than that implies an employer-bought B2B
motion, which pulls in the MSA/DPA work already noted in Phase 4.

**Side benefit:** voice + saved coaching context + roleplay scoring history is exactly
the "capability ChatGPT lacks natively" bar OpenAI wants for a published plugin. The
plugin question deferred earlier gets unblocked by shipping voice.

Interim: `/manager-roleplay` now says voice is on the roadmap and explains why it
matters for this audience. Honest, and it stops the page reading as though text is the
intended end state.

## What not to do

**Don't broaden the scenarios.** Adding "managing up" and "scope creep" would put
Frontline Coach in a fight with a funded category on their terms while abandoning the
only audience nobody else is serving.

## Concrete actions

1. **`/manager-roleplay` needs a second disambiguation.** It currently separates from
   frontline.coach (sales roleplay). It does not separate from tools built for tech
   managers. One paragraph naming the audience difference — hourly frontline
   supervision, not knowledge work — makes the page harder to conflate.
2. **Lean harder on documentation and in-the-moment help** across the site. Those are
   the capabilities no roleplay competitor has, and they're what makes this a system
   rather than a practice tool.
3. **Plan a Product Hunt launch.** Their playbook is the answer to the external-links
   problem, and it's the highest-leverage non-code task on the list.

## Honest read

Peopling is well-built, thoughtfully made, and aimed somewhere else. It's more of a
competitor than frontline.coach is on rehearsal specifically, and less of one overall.
The threat isn't that they'll take frontline supervisors — it's that they'll be the
answer an AI gives to "practice difficult conversations" while Frontline Coach has no
external footprint to compete with, on a query where Ben's product is arguably more
complete.
