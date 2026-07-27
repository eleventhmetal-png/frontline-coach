# Frontline Coach — Discoverability Content Plan

**Status:** ALL PAGES SHIPPED 2026-07-27. Seven live: `/operator`,
`/new-manager-coach`, `/employee-pushback`, `/difficult-employee-conversations`,
`/standard-slipping`, `/manager-roleplay`, `/manager-documentation`. 34 FAQ pairs
with `FAQPage` schema, all cross-linked, all in the sitemap.
**Owner:** Ben Ryan
**Goal:** be the answer an AI gives when a frontline supervisor describes a people problem.

> **Two things changed once real usage data arrived** (see `docs/real-usage-analysis.md`).
>
> `/employee-pushback` was outlined around "That's not my job." Real users never typed
> that — they hit *"You never told me that"*, *"I didn't know that was a rule"*, and
> *"You're targeting me"*. The page was rebuilt around those three.
>
> `/standard-slipping` was added, and wasn't in the original five. Two of fifteen users
> described one person's behaviour spreading to the crew, unprompted. Nothing in the
> plan covered it.

> **What is NOT done, and it's the part that matters now.** Everything above is
> supply-side. Seven good pages create zero demand. There are no external links to this
> domain, no third-party mentions, no reviews, and no users outside the internal pilot.
> AI recommendation systems weight external corroboration heavily, and a page nobody
> links to gets crawled late and trusted little. The remaining work is earning those
> signals, and none of it is a build task. See "What's actually left" at the bottom.

---

## 1. The call: what we target, and what we don't

### Not targeting: "leadership"

That query space belongs to HBR, Gallup, FranklinCovey, SHRM, and a few thousand
coaching firms with twenty years of domain authority and thousands of indexed
pages. A brand-new domain does not enter that fight and win. Money and effort
spent there returns nothing.

### Not targeting: the brand name "Frontline Coach"

`frontline.coach` has the cleaner domain, 20+ indexed subpages, a pricing page,
role pages, industry pages, and a real content operation behind it. Anyone
searching the bare brand name gets them. Accept that and route around it —
the full name "Frontline Coach by Own The Shift" is now in the title tag,
metadata, and structured data, which is enough to keep the two products
distinguishable once someone lands.

### What we target: the wedge

`frontline.coach` sells to **sales and CX teams** — SDRs, AEs, customer success,
renewals, churn rescue. Read their site: every solution page, every industry
page, every use case is revenue-facing.

Frontline Coach by Own The Shift sells to **hourly-workforce supervision** —
shift leads, crew chiefs, assistant managers, first-time supervisors in car
washes, restaurants, retail, warehouses, distribution, and manufacturing.

The query overlap between those two audiences is approximately zero. Nobody
searching "how do I write up an employee who keeps showing up late" is going to
be served by a MEDDIC roleplay tool. That gap is the whole opportunity.

### The actual target: problem language, not category language

Frontline supervisors do not search "leadership development software." They
search the thing that is happening to them right now, in the words they'd use
telling a friend about it:

- "how to tell an employee they need to improve"
- "employee said that's not my job what do I say"
- "how do I write someone up for attendance"
- "new supervisor and my team doesn't respect me"
- "what to say when an employee gets defensive"
- "how to document a verbal warning"
- "employee is good at the job but bad attitude"

That is low-competition, high-intent, and it maps exactly to what the app
already does. Five pages built around this language will outperform fifty thin
posts about "the 7 habits of great leaders."

---

## 2. The five pages

Build in this order. Each one ships complete before the next starts. Add each URL
to `public/sitemap.xml` **only when it is live and returning 200** — never before.

---

### Page 1 — `/new-manager-coach`

**Why first:** widest audience, matches the homepage headline, and it's the
page that most directly answers "I just got promoted and I'm drowning."

**Title:** `AI Coaching for Newly Promoted Managers and First-Time Supervisors`

**Target queries:**
- just got promoted to supervisor and don't know what I'm doing
- first time manager help
- new shift lead training
- promoted from within now managing former coworkers
- new supervisor mistakes
- how to lead a team I used to work on

**Outline:**
1. **The situation.** You got promoted because you were good at the work. Nobody
   trained you to manage the people doing it. Week one, somebody calls off and
   somebody else pushes back, and you're improvising.
2. **The mistake most new supervisors make.** Trying to stay liked. Softening
   the standard so the conversation stays comfortable. It buys a week and costs
   the crew.
3. **What actually works.** Standard first, relationship second. The standard is
   the kindness — people can't hit a target they can't see.
4. **A real example.** Former coworker, now your direct report, showing up five
   minutes late every shift. Include the wrong opening line and the right one.
5. **How Frontline Coach helps.** Which tools, specifically, and what a session
   looks like.
6. **Limitations.** Coaching guidance, not HR or legal advice. Follow company
   policy. What the app doesn't do.
7. **FAQ.** 4–6 questions in the visitor's actual words.

---

### Page 2 — `/employee-pushback`

**Why second:** highest-intent query set on the list. Somebody searching this is
usually searching it the same day it happened.

**Title:** `What to Say When an Employee Pushes Back`

**Target queries:**
- employee said that's not my job
- what to say when an employee argues with you
- employee refuses to do a task
- how to respond when an employee gets defensive
- employee questions my authority
- employee talks back to supervisor

**Outline:**
1. **The situation.** You gave a direction. They pushed. Now everyone within
   earshot is watching to see what you do.
2. **The mistake.** Two failure modes, both common: escalate and win the moment
   while losing the person, or fold and teach the crew that the standard is
   negotiable.
3. **What actually works.** Separate the pushback from the task. Acknowledge,
   hold, then move. Handle the *why* after the shift, not during it.
4. **Real example.** "That's not my job." Word-for-word wrong response and
   word-for-word better one.
5. **The three most common pushback types** and a line for each.
6. **How Frontline Coach helps.** Pushback Coach, live, in the moment.
7. **Limitations + FAQ.**

---

### Page 3 — `/difficult-employee-conversations`

**Title:** `How to Prepare for a Difficult Employee Conversation`

**Target queries:**
- how to tell an employee they need to improve
- how to have a hard conversation with an employee
- how to talk to an employee about attitude
- what to say in a performance conversation
- dreading a conversation with an employee
- how to start a difficult conversation with a team member

**Outline:**
1. **The situation.** You've been putting it off for two weeks. It's gotten
   worse. Now the conversation is bigger than it needed to be.
2. **The mistake.** Winging it. Or over-scripting it into something robotic.
   Or opening with a compliment sandwich that buries the actual message.
3. **What actually works.** Know your opening line, your specific observable
   facts, and the one thing you need different going forward. Three things. Not
   a script.
4. **Real example.** A performance conversation, planned versus improvised.
5. **How Frontline Coach helps.** Conversation Builder, plus Practice to rehearse
   it first.
6. **Limitations + FAQ.**

---

### Page 4 — `/manager-roleplay`

**Why here:** this is the page most likely to collide with `frontline.coach` in
search, since roleplay is their headline feature. Differentiate hard on audience
in the first paragraph — AI employee on a shift floor, not an AI buyer on a
sales call.

**Title:** `AI Roleplay for Difficult Manager Conversations`

**Target queries:**
- practice difficult conversations with AI
- roleplay employee conversation
- how to practice giving feedback
- manager conversation practice
- rehearse firing an employee
- AI practice for management conversations

**Outline:**
1. **The situation.** The first time you say the words out loud shouldn't be to
   the actual employee.
2. **The mistake.** Rehearsing in your head. In your head, they agree with you.
   In reality they get defensive, deflect, or bring up something you didn't plan
   for.
3. **What actually works.** Practice against resistance, not agreement.
4. **What a session looks like.** Include a real transcript excerpt. This page
   needs a visible sample more than any other page on the list.
5. **How it's different from generic AI.** The AI employee pushes back the way an
   actual frontline employee pushes back.
6. **Limitations + FAQ.**

---

### Page 5 — `/manager-documentation`

**Why last:** narrowest audience, but the highest-trust query — and the one where
guardrails matter most. Do not ship this page without the disclaimers written
tight.

**Title:** `How Managers Document Employee Conversations Factually`

**Target queries:**
- how to document a verbal warning
- how to write up an employee
- what to write in employee documentation
- documenting employee performance issues
- how to write a coaching note
- do I need to document a verbal conversation

**Outline:**
1. **The situation.** Something happened on shift. In four months it matters, and
   your memory of it is a feeling instead of a fact.
2. **The mistake.** Writing conclusions instead of observations. "Bad attitude"
   is an opinion. "Told me 'I'm not doing that' in front of two coworkers at
   4:15" is a fact.
3. **What actually works.** Observable, specific, dated, neutral. What was said,
   what was seen, what was agreed.
4. **Real example.** Rough notes in, clean record out.
5. **How Frontline Coach helps.** Documentation Assistant.
6. **Guardrails — expand this section.** Organizes factual observations. Does not
   replace company policy, HR, or legal advice. Does not make termination
   decisions. Follow your company's process. State clearly what the app stores.
7. **FAQ.**

---

## 3. Rules that apply to all five pages

**Structure is the same every time.** Situation → the mistake → what works →
real example with actual words → how the app helps → limitations → FAQ. The
example and the FAQ are the parts AI systems quote. Do not skip them.

**Problem before product.** Four-fifths of each page is useful whether or not
somebody signs up. That is what makes it citable. A page that only sells gets
ignored by recommendation systems and by readers.

**Include the actual words.** Every page needs at least one wrong opening line
and one better one, in quotes. This is the single highest-value element on the
page and the thing no competitor is doing for this audience.

**FAQ in the visitor's language.** 4–6 questions phrased the way somebody would
type them, each answered in 2–4 sentences. Once these exist, add `FAQPage`
JSON-LD to each page — it's a direct feed into AI answer generation.

**Every page gets:** unique title and meta description, canonical URL, an
`Article` JSON-LD block referencing the `Organization` node already defined in
`index.html`, a link to the app, and links to two sibling pages.

**Real proof only.** No invented testimonials. Use the GM field-test feedback
already on file, with permission and role/industry attached. Two anonymized
before-and-after examples beat ten generic quotes.

**Five strong pages beat fifty thin ones.** Do not pad the count.

---

## 4. Sequencing

**Done (2026-07-27):**
- Real `robots.txt` with explicit `OAI-SearchBot` allow
- Real `sitemap.xml` with only live URLs
- SPA catch-all removed — missing URLs now return a proper 404
- Homepage marketing copy prerendered into the initial HTML payload
- `SoftwareApplication` + `Organization` JSON-LD with explicit disambiguation
  from `frontline.coach`
- Title and metadata standardized to "Frontline Coach by Own The Shift"

**Next, before any content work:**
1. Deploy and verify the above on the live domain.
2. Submit `sitemap.xml` to Google Search Console and Bing Webmaster Tools.
3. Write the operator/founder page — real frontline experience, why the app
   exists. This is the authority signal, and it's the cheapest one to produce
   because it's already in your head. Arguably page zero of the five.
4. Add a waitlist capture so discovery traffic that hits a closed beta leaves an
   email instead of bouncing. Netlify Forms is already wired for `tool-feedback`;
   the same pattern works here.

**Then content, one page at a time:** `/new-manager-coach` →
`/employee-pushback` → `/difficult-employee-conversations` →
`/manager-roleplay` → `/manager-documentation`. Add each to the sitemap on
publish.

**Explicitly deferred:**
- `llms.txt` — not required for ChatGPT Search inclusion. Ignore for now.
- ChatGPT plugin — OpenAI expects a plugin to do something ChatGPT can't already
  do natively. Generic advice and basic roleplay don't qualify. Revisit when
  saved coaching context, policy grounding, and roleplay scoring history are
  real. It also raises the privacy stakes, since managers would be entering
  employee information.

---

## 5. How we'll know it's working

Set expectations honestly: indexing takes weeks, and authority takes months.
Nothing here pays off in a week.

Watch, in order of usefulness:

1. **Referral traffic with `utm_source=chatgpt.com`.** The direct signal that an
   AI recommended the site.
2. **Search Console impressions on problem-language queries** — not brand
   queries. Brand queries mean somebody already knew about you; problem queries
   mean discovery is working.
3. **Crawl coverage in Search Console.** Confirms the 404 fix and sitemap took.
4. **The manual check:** ask ChatGPT, Claude, and Perplexity a cold question —
   "what's a good tool to help a new shift supervisor handle a difficult employee
   conversation?" — without naming the product. Log the answer. Re-run monthly.
   That's the actual scoreboard.

---

## What's actually left

Nothing below is a coding task, which is why it's harder than everything that came
before it.

**1. Batch the index requests.** Seven URLs in Google Search Console → URL Inspection
→ Request Indexing. The sitemap covers Bing.

**2. Sample outputs.** The original audit asked for a visible working demonstration and
it's the one proof item still missing. A real roleplay transcript, a conversation plan,
a documentation before-and-after. Fully within Ben's control, needs nobody's permission,
and it's the difference between claiming the app works and showing it.

**3. External beta users.** Thirty slots, zero used. Every current user is an internal
pilot at Ben's employer, which means they cannot be quoted publicly (see
`docs/proof-layer-draft.md`) and they aren't evidence of outside demand. Recruiting
supervisors from outside — r/managers, restaurant and retail supervisor groups,
LinkedIn — fixes both problems at once.

**4. Any external link at all.** The domain currently has none. This is the single
biggest remaining weakness and the slowest to fix. One relevant mention on a site
somebody else owns is worth more than another page here.

**5. Housekeeping.** Raise the Supabase email rate limit above 30/hour before any
traffic push. Confirm minimum password length is 8 or lower. Delete the leftover test
accounts via Authentication → Users.

**6. Fold `gen-legal-html.mjs` into `gen-pages.mjs`.** Two templates now exist for what
should be one. Low priority, no user impact, but it will drift eventually.
