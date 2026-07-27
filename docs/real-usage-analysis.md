# Real usage data — what supervisors actually brought to the app

**Source:** `tool-feedback` Netlify form export, 15 submissions, 23 June – 21 July
2026, 9 unique IPs.

**What it is:** the situation a user typed in, plus a thumbs rating, captured at the
moment they used a tool. Not survey answers. Not what they told their boss they
thought. The actual problem, in their words, while they were dealing with it.

That makes it the best content input in the project.

---

## Caveats before anything else

**All 15 are thumbs-up. Zero thumbs-down.** Do not read that as a 100% satisfaction
rate and do not put that number on the site. Rating buttons collect enthusiasm — an
unhappy user closes the tab, they don't stop to rate. Nine users producing fifteen
ratings over a month is a signal that the tool got used repeatedly, and nothing more
than that.

**Privacy.** The export contains IP addresses and user agents. Those don't belong in
the repo, on the site, or in any doc that gets shared. Nothing below includes them.

**One input names an employee** ("Jossue"). Stripped everywhere below and must not be
published.

---

## Tool usage

| Tool | Uses |
|---|---|
| AI Coach | 6 |
| Roleplay / Practice | 4 |
| Pushback Coach | 3 |
| Conversation Builder | 1 |
| Skill vs. Will | 1 |

AI Coach is the front door. Roleplay is being used more than expected for a feature
that requires deliberate effort — people are rehearsing, not just asking.

---

## Theme 1 — Attendance and reliability (2)

> Employee keeps calling off work.

> Employee is repeatedly late

Confirms attendance as a core query cluster. `CONTENT-PLAN.md` already targets
"how do I write someone up for attendance" — this is real demand behind it.

## Theme 2 — Performance sliding (4)

> Employee not improving after coaching

> Underperforming new hire

> My new hire SC isn't performing great

> Employee is starting to not stay on task, doing tasks half ass.

"Not improving *after* coaching" is the interesting one. That's a supervisor who
already had the conversation and got nothing. Nobody writes for that moment, and it's
a page of its own eventually.

## Theme 3 — The problem is spreading (2)

> My assistant manager is great with customers but keeps letting the closing
> checklist slide. Team has started copying him and skipping steps too.

> My employee argues and is dismissive whenever they are approached with something
> that challenges how they do things. What's worse they do it in front of other
> people. The attitudes of the site are cha[nging]

**This is the best material in the dataset.** Both users are describing contagion —
one person's behaviour becoming the crew's behaviour. That's the fear that actually
drives a supervisor to act, and it isn't a theme in the current content plan at all.

The assistant manager example is close to perfect for a page: somebody good at the
visible part of the job, quietly failing at the unglamorous part, and the team
learning from it.

## Theme 4 — Pushback, in the employee's own words (3)

These three inputs are what the *employee* said. Highest-value lines in the file.

> You never told me that

> I didn't know that was a rule

> You're targeting me

## Theme 5 — Other (2)

> Employee asking for promotion

> Defensive employee

Plus one recognition conversation about a reliable employee. Recognition is
underused — one submission out of fifteen — which matches the GM's report that the
tool was more useful for coaching than for praise.

---

## What this changes in CONTENT-PLAN.md

**1. `/employee-pushback` was built on the wrong assumption.**

I wrote that page's outline around "That's not my job" as the archetypal pushback. It
appears once in the GM's email and **zero times** in real usage.

The actual dominant pattern is different, and it splits two ways:

- **"I wasn't told."** — *"You never told me that"* / *"I didn't know that was a
  rule."* A claim of ignorance, which may be completely true and is the supervisor's
  problem to have prevented. This connects straight to the `/operator` thesis: the
  employee who didn't know because nobody taught them.
- **"You're singling me out."** — *"You're targeting me."* An accusation of unfairness,
  which needs a completely different response and is far more likely to escalate.

Those are three different conversations. The page should be organised around them
rather than around "that's not my job," and each needs its own words.

**2. Add a page on the standard spreading.**

Two of fifteen users described one person's behaviour infecting the crew, unprompted.
Nothing in the current five covers it. Candidate: `/standard-slipping`, built on the
assistant-manager-and-the-closing-checklist scenario.

**3. Replace the invented example in `/new-manager-coach`.**

The late clock-in scenario I wrote is fine but fictional. "Employee is repeatedly
late" is a validated real query, and the assistant manager checklist case is a real
situation described in a real supervisor's words. Use real material.

**4. Deprioritise recognition.** One submission out of fifteen, and the GM said the
same. Not worth a page yet.

---

## What not to do with this

Don't publish the raw inputs. They're real supervisors describing real employees, and
two are specific enough to identify someone. Use them to choose what to write about
and to get the *language* right — not as quotes.

The one exception worth considering: the three pushback lines are generic enough to be
universal. *"You never told me that"* could come from any employee anywhere. Those are
safe to use as section headings on `/employee-pushback`.
