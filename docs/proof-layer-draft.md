# DRAFT — Proof layer

**Source:** email from a General Manager, 21 July 2026, relaying feedback from five
Team Leads who used Frontline Coach to prepare one-on-ones. Each TL picked two
employees to meet with. Most used Prepare a Conversation beforehand.

**Constraints applied:** no company name, no individual names, no industry. Titles
only — Team Lead, General Manager.

---

## The integrity problem, and how this handles it

The email is a **General Manager's summary** of what five Team Leads told him. It is
not five Team Leads speaking. Sentences like "Tyler Hammond felt the biggest value
was helping him find the right approach" are the GM's words about Tyler, not Tyler's
words.

So none of this can go on the site inside quotation marks attributed to a Team Lead.
That would be inventing testimony.

What it can be — and this is more credible than testimonial pull-quotes anyway — is a
**reported pilot result**. Framed honestly, it reads like evidence instead of
marketing, and it's the kind of thing an AI search system will treat as a real signal.

**If you want actual quotes,** ask each Team Lead for one sentence in their own words
and permission to publish it with their title. Then they're quotable. That's a short
email and it's the only clean path to quotation marks.

---

## Proposed section for the landing page and `/new-manager-coach`

### What happened when Team Leads actually used it

In July 2026, five Team Leads at a multi-site hourly operation used Frontline Coach
to prepare one-on-one conversations. Each picked two of their people. Most used
Prepare a Conversation before the meeting to plan the approach.

What their General Manager reported back:

- It was **more useful for coaching conversations than recognition ones**. It gave
  Team Leads a structured way to raise a performance problem without the employee
  feeling like they were just getting in trouble.
- It got them **asking better questions** instead of telling people what to fix.
  Several said that made the conversations feel collaborative rather than one-way.
- One Team Lead used it after an employee answered a request with **"That's not my
  job."** He got several approaches depending on the person's personality, and said
  it helped him slow down and think instead of reacting while emotions were high.
- Another said it helped him **avoid sounding frustrated or aggressive** while still
  communicating urgency — and that it opened conversations in a way that didn't feel
  like walking into a disciplinary meeting.
- One used it to prepare for an employee frustrated about **getting scheduled once a
  week**, and said the suggested questions kept his tone consistent.
- The more detail they gave it, the more useful the coaching got.

**What they didn't like.** Responses ran too long to read mid-conversation — one Team
Lead said he felt he was losing the employee's attention while trying to keep up with
the screen. Several wanted a condensed version with just the key talking points, and
step-by-step guidance instead of everything at once. Some of the language read as
robotic.

Every one of those is now built.

Responses got shorter and the live tools stream so you're not waiting on a wall of
text. There's a delivery layer that tells you *how* to say something, not just what,
and it reads the register of the situation so a coaching conversation and a hard
correction don't come out in the same voice. And Frontline Coach now remembers who
you've coached and what you covered, so a follow-up two weeks later builds on the last
conversation instead of starting cold.

That last one was a Team Lead's suggestion. It shipped.

---

## Notes for Ben

**Include the criticism — it's now the strongest part of the section.** Five Team
Leads raised five problems and every one of them is in the product. That's a
verifiable claim about how you operate, and it's worth more than any amount of praise.
Anyone can collect compliments. "They told us it was too long and too robotic and
didn't remember anything, so we fixed all three" is a different kind of statement.

Verified in the code before writing it: `src/lib/employeeMemory.js` exports
`getCoachedEmployees`, `getEmployeeHistory`, and `summarizeEmployeeHistory`, called in
seven places in `App.jsx`. The delivery layer (`howToDeliver`, `makeItYours`,
`howToSayIt`), register detection, and `scrubVoice` are all live. I didn't take the
claim on faith.

**Two things I stripped:** the word "wash" (industry signal) and every first and last
name. Titles only, per your instruction. "A multi-site hourly operation" is accurate
and identifies nothing.

**One thing to check with Landon.** Even paraphrased and anonymised, this is his
report about his Team Leads. Worth a heads-up that you're using it publicly in this
form — partly courtesy, partly because he's the one who'd hear about it if a TL
recognised themselves in the scheduling detail.

**Two details that could identify individuals** if someone from that operation reads
it: the "That's not my job" incident and the "scheduled once a week" complaint. Both
are specific enough that the employees involved might recognise themselves. The
lessons survive without them if you'd rather cut them, but they're also the two most
concrete things in the section. Your call.

---

## A finding worth acting on separately

One of your Team Leads hit **"That's not my job"** in real use, unprompted.

That is verbatim one of the target queries in `CONTENT-PLAN.md` for page two,
`/employee-pushback` — "employee said that's not my job." A real frontline supervisor
walked into that exact situation and needed help with it, which means the query list
isn't guesswork.

It also means page two has a real scenario behind it before it's written. Worth
bumping `/employee-pushback` up the order, or at least writing it right after
`/new-manager-coach`.
