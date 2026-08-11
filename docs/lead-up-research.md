# Leading Up the Chain — Research Brief

**Date:** 11 August 2026 (rev. 2 — industry-neutral)
**Purpose:** Research input for the upward-conversation feature (Escalate / Disagree / Ask registers)
**Source:** *HBR Guide Collection* — *HBR Guide to Managing Up and Across*, Section 1 in full, plus Conger, Cialdini, Gallo, Craumer from Section 2

**Language rule for this document:** everything here is written industry-neutral. The registers serve all eight industries, and an upward conversation isn't specific to shift work, retail, or any one setting. Texture comes from the existing per-industry WORLD blocks in `src/App.jsx` — not from the register prompts. Roles are named generically: the **user**, their **boss**, and the **next level up**.

---

## 00 — The headline finding

**The canonical corporate source is nearly silent on the one thing Ben named as the core use case.**

"How do I get behind a decision I don't agree with" gets roughly four sentences in a 190-page guide — one quote from a former IBM exec about making your case forcefully and then snapping around to "OK, here we go." No framework, no script, no failure-mode analysis.

Everything else in the book is about *getting your way*. Almost nothing is about carrying a decision you lost. That half is where frontline leadership lives.

**Consequence for the build:** Escalate and Ask can be grounded in existing material. Disagree only half-can — the commit side has to come from operator experience and the Jocko/Lencioni lens. That's the part a competitor scraping HBR content can't replicate.

---

## 01 — The foundation move

Hill & Lineback: *"What's your boss on the line for? What's her boss telling her to do?"*

Nearly every failed upward conversation is the same failure: the ask is priced in a currency the boss can't pay in.

- **What the user says:** "We need another person out here, everyone's burnt out." → asks the boss to spend labor to buy morale. There's no line item for that.
- **Same ask, translated:** "We're one person short during our busiest window and work is backing up. Three days this week." → asks the boss to spend labor to buy output. That's on the scoreboard.

The prep work is knowing the boss's actual scoreboard — labor cost, output, quality scores, customer complaints, safety, turnover, whatever revenue number their site owns — and which of those they are personally being asked about this month.

**Build note:** first question the tool asks, and it can't be skipped — *"What is your boss being measured on right now?"* If the user doesn't know, that's the coaching moment. Go find out, don't go have the conversation.

---

## 02 — Escalate

Governing rule, and it's correct: *"No boss likes to be surprised... If you must err, do it on the side of overinforming."*

Surprise has a specific shape at the frontline: the boss finds out from their own boss, or from a customer complaint, or from a camera. The damage isn't the incident — it's that they looked like they didn't know their own operation.

**Five steps, compressed for a two-minute conversation (HBR's version assumes a scheduled meeting):**

1. **Headline it.** Punch line first. "I need to tell you something before you hear it somewhere else."
2. **Facts, no editorial.** What, when, who, what it cost.
3. **What you already did.** Separates a report from a hand-off.
4. **What you need.** A decision, a resource, or nothing — "just visibility" is a legitimate ask and should be named as one.
5. **Own it.** "This is on me." No hedge.

### The rule on bringing a solution — REFINED

HBR states it flatly: *"never bring a problem to your boss without a proposed solution."* Read literally, that teaches people to sit on problems until they've solved them, which is how a small thing becomes a phone call from two levels up.

But the fix isn't to drop the requirement. **The solution requirement is a gate on thinking, not a gate on timing.**

> Never sit on a problem waiting to solve it. Never arrive without a take, either.
> **"Here's what I'd do" is required. "Here's the right answer" is not.**

A leader who brings a problem with no proposed action is doing one of two things: complaining, or looking for the easy button. Both are trainable habits, and both are the wrong ones to train. Requiring a proposed action forces the person to actually look at the problem and think it through — which is the skill being built, not the answer being produced.

Any manager worth their weight can problem-solve their way from a wrong idea to a right one. They can't do anything with an empty hand.

**Build rule:** the Escalate register must require the user to state what they'd do, and must not accept "I don't know" as an answer. If they can't produce one, the tool works them to one — that *is* the coaching. Grade the thinking, not the correctness.

---

## 03 — Disagree

### Part one: the case

Conger's three failure modes map exactly onto real behavior:

| Mistake | What it looks like |
|---|---|
| The John Wayne open | "This policy is going to kill us." Stating your position hard up front hands your boss something to plant their feet against. Open with the shared goal or a question. |
| Refusing to compromise | Treating movement as losing. Signals persuasion is one-way. Nobody buys in until they see you can bend. |
| Treating it as one shot | Making the case once, getting a no, concluding the boss doesn't listen. Plant it, let it sit a day, come back with what you learned. |

**Mechanic worth building in:** *"Those who speak up only when they disagree will usually enjoy less influence than those who have demonstrated prior support. So on those occasions when you do honestly agree, say so clearly and explicitly."* Influence is a balance you deposit into before you withdraw. Coachable outside any single conversation.

### Part two: the commit — NOT IN THE SOURCE

Only line the book offers (Harreld on Gerstner): *"You make your recommendation as forcefully as you can. And once the decision is made, you have to snap around and say, 'OK, here we go.' And sometimes people can't — they get strident. And sometimes they have to leave the team."*

**The failure this misses — disowning the decision to your own team:**
"Corporate says we have to." "Don't shoot the messenger." "I don't like it either."
Buys five minutes of being liked, costs the authority to enforce anything for a year. The team learns a standard is negotiable if they complain to you — because you just modeled complaining about it to them.

**The standard:**
- State the decision as *the decision*, not as something happening to you both.
- Say what you understand the reason to be. Don't know it? Say so and go find out — don't fill the gap with a guess or a shrug.
- Name what it means for their day, concretely, tomorrow.
- You may say "I raised concerns and the call went the other way." Honesty about process is fine. Distancing from the outcome is not.

Line to hold: **transparent that you disagreed, never neutral about whether it gets executed.**

---

## 04 — Ask

Conger's four steps hold: credibility, common ground, vivid evidence, emotional connection. The compression is Gallo's framing — start with what you want, set the scene briefly, name the complication, connect it to the bigger number, end with a specific call to action.

**Highest-leverage tactic in the book for this audience** (from the conflict-averse-boss chapter): *"If you want your boss to use her authority on your behalf, give her everything she needs to build her case."*

Translation: the user's boss usually isn't the one who can say yes — they have to go ask the next level up. So write the ask in a form that can be forwarded without editing. Most frontline requests die not because the answer was no, but because they were never repeated accurately one level up.

---

## 05 — Boss decision styles → roleplay counterparts

The book's five archetypes are a useful concept, useless as written (examples are Iacocca, Gates, Martha Stewart). Rebuilt:

| Boss type | How to bring it |
|---|---|
| **The numbers boss** | Show the math or don't bother. Accepts a smaller proven ask over a bigger argued one. Bring the count, not the feeling. |
| **The gut boss** | Doesn't move on spreadsheets — moves on precedent and people. "We ran it this way at another location, here's what happened." |
| **The firefighter** | Drowning, reactive all day. One decision, two options, ninety seconds. Longer than that and they defer it; deferred means dead. |
| **The one who won't push back upward** | Conflict-averse with their own boss, so the ask dies on their desk. Hand them written, short, forwardable ammunition. |

Same scenario against a numbers boss vs. a firefighter should produce genuinely different conversations, or the roleplay isn't teaching anything.

---

## 06 — Throw this out

**"Get sneaky."** The book's bad-environment advice: figure out which boss has the most power, prioritize their work, and "like a kid playing parents off each other," ask the one who'll give you the answer you want. Opposite of ownership — and in any multi-site operation, your boss and their boss talk daily. You get caught inside a week.

**Boss's-boss networking.** Emailing your boss's boss article links, tapping them for career advice. Fine in a corporate office; at the frontline it reads as going around your boss and will be treated that way.
→ *Replace with a chain rule:* never bring your boss's boss a problem your boss hasn't heard first. **Carve-out, stated plainly and never buried:** safety, harassment, theft, or being directed to do something illegal go up immediately and the chain doesn't apply.

**Most of Cialdini.** Reciprocity and consistency are behavioral and fine. Liking, scarcity, "stroke your boss's ego" are levers — a frontline boss smells a lever instantly. Doesn't fit the product voice, doesn't survive contact with someone who's been managing for fifteen years.

**All mentor/sponsor/personal-brand material.** LinkedIn, Twitter feeds, Google alerts on your mentor's interests, finding a New Yorker cartoon for the boss's deck. Doesn't exist in the users' world.

---

## 07 — Build implications

1. **Three registers confirmed.** Escalate (speed + ownership), Disagree (sequence + commitment), Ask (currency translation) are distinct enough to need separate prompt blocks.
2. **Write the registers industry-neutral.** No setting-specific nouns in the register prompts. The per-industry WORLD blocks already carry the texture — that's the layer that makes it concrete, and it's already built for all eight.
3. **Gate all three on the same question:** what is your boss being measured on right now? No scoreboard, no conversation.
4. **The proposed-action requirement is a hard gate.** The tool doesn't accept "I don't know what to do about it." It works the user to a take and grades the thinking, not the correctness.
5. **Four counterpart profiles for roleplay:** numbers, gut, firefighter, won't-push-back. Pushback behavior must differ meaningfully by profile.
6. **Upward-roleplay scoring dimensions** (different from the downward ones already built): led with the headline; brought a proposed action; priced the ask in the boss's currency; owned it without hedging; committed at the end.
7. **Hard guardrail.** The tool coaches people to go *through* their boss, not around — only exception is the safety/legal/harassment carve-out. This is also what makes the feature sellable to a B2B buyer, who is by definition somebody's boss.
8. **The commit half is original work.** No competitor pulling from the standard corpus will have it, because it isn't in the corpus.

---

*Quoted passages are attributed excerpts used as research input. Frameworks are restated and re-derived for frontline operations, not reproduced.*
