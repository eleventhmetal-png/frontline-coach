// Content for the public static marketing pages, kept separate from the React app
// so scripts/gen-pages.mjs can generate real crawlable HTML at build time.
//
// WHY THIS EXISTS: the app is a single-page React app with no router, so there is
// no way to serve /operator (or the five planned use-case pages) from inside it.
// Public pages have to be actual files in public/, the same way terms.html and
// privacy.html are. This file is the single source of truth for their copy;
// gen-pages.mjs owns the markup and styling so every page stays consistent and
// adding a page never means copy-pasting a <head> block.
//
// Netlify's Pretty URLs serve operator.html at /operator, which is why canonical
// URLs here are extensionless.
//
// Block types understood by the generator:
//   { h2:   "Section heading" }
//   { p:    "Paragraph text." }
//   { em:   "Paragraph with the whole thing emphasised." }
//   { belief: { lead: "The principle.", rest: "The explanation." } }
//   { sig:  "— B.W. Ryan" }

export const SITE = "https://frontline-coach.com";
export const ORG_ID = "https://otsowntheshift.com/#org";
export const APP_ID = "https://frontline-coach.com/#app";
export const WEBSITE_ID = "https://frontline-coach.com/#website";
export const PERSON_ID = "https://otsowntheshift.com/#ben-ryan";

// The App Store listing lives in its own dependency-free module so the browser bundle
// can read it too — this file reads process.env and must never reach the browser.
// Set APP_STORE_ID there, in one place.
export { APP_STORE_ID, APP_STORE_URL } from "./appStore.js";
import { APP_STORE_URL } from "./appStore.js";

// GUIDELINE 2.2 — these generated pages ship INSIDE the Capacitor binary, because
// gen-pages.mjs writes to public/ and Vite copies public/ into dist/. AuthGate links
// to /pricing straight from the sign-in screen, so a reviewer can reach this copy in
// two taps. The beta framing has to come off in the store build.
//
// This file is imported by gen-pages.mjs (Node), never by the browser bundle, so it
// reads process.env rather than import.meta.env. `npm run build:store` sets it.
//
// Side effect worth knowing: a store build leaves store-flavoured HTML sitting in
// public/. `npm run build` regenerates it, so a Netlify deploy self-heals — but don't
// hand-deploy dist/ straight after a store build.
const STORE_BUILD = process.env.VITE_STORE_BUILD === "1";
const b = (web, store) => (STORE_BUILD ? store : web);

export const PAGES = [
  {
    slug: "operator",
    navLabel: "Why I built Frontline Coach",
    related: ["new-manager-coach", "difficult-employee-conversations", "pricing"],
    title: "Why I Built Frontline Coach — B.W. Ryan, Own The Shift",
    // Keep descriptions between 120 and 158 characters. Bing's SEO checker
    // errors outside that range and Google truncates the overflow.
    description:
      "Why I built Frontline Coach. Eighteen years of frontline leadership learned the wrong way first, and what I got wrong about teaching a standard.",
    h1: "Why I Built This",
    // Extra JSON-LD nodes for this page, merged into the graph by the generator.
    schema: [
      {
        "@type": "ProfilePage",
        "@id": `${SITE}/operator#page`,
        url: `${SITE}/operator`,
        name: "Why I Built Frontline Coach",
        mainEntity: { "@id": PERSON_ID },
        about: { "@id": APP_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en-US",
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: "B.W. Ryan",
        jobTitle: "Founder",
        url: `${SITE}/operator`,
        description:
          "Navy veteran and eighteen-year frontline operations leader. Founder of Own The Shift and creator of Frontline Coach, an AI leadership-coaching app for newly promoted managers and shift leads.",
        knowsAbout: [
          "frontline leadership",
          "first-time supervisors",
          "employee performance conversations",
          "workplace coaching",
          "hourly workforce operations",
          "employee documentation",
        ],
        worksFor: { "@id": ORG_ID },
      },
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Own The Shift",
        legalName: "OTS Media LLC",
        url: "https://otsowntheshift.com/",
      },
    ],
    blocks: [
      { p: "I spent eighteen years learning frontline leadership the wrong way first." },
      {
        p: "I got the lessons. The people who worked for me got the bill. Some of them quit. Some of them started questioning whether they were any good at the work, and that was on me.",
      },

      { h2: "The one I still think about" },
      {
        p: "My first civilian leadership job, I had a department manager who wasn't staying on top of her responsibilities. Rotation, expiration dates, ordering. Things that go wrong quietly and then all at once.",
      },
      {
        p: "So I stayed on her about it. Addressed it right there, every time I saw it. On the floor, in the moment, in front of whoever happened to be standing there. She didn't turn it around, so I moved her out of the role.",
      },
      {
        p: "I wasn't a documenter. That was never my process. I called it out on the spot and expected it fixed, and if competency didn't show up after that, you got demoted or you were done. Clean, fast, final. I thought that was what accountability looked like.",
      },
      {
        p: "Here's what I never bothered to find out: she didn't know how to do half of what she was accountable for. Nobody had ever shown her. I knew how to do all of it, and it did not once occur to me that teaching her was my job. I had the answer in my pocket the entire time and used pressure instead.",
      },
      {
        p: "She didn't need me on her about it. She needed twenty minutes and somebody willing to walk her through it.",
      },
      {
        p: "It isn't like that anymore. I lead with care now, and I'd be lying if I said that came naturally or quickly. It took years, and it cost other people while I got there.",
      },

      { h2: "Why I assumed they knew their job" },
      {
        p: "I came out of the Navy, off an aircraft carrier. Everybody there knew their job because they had to. On a ship like that, if you don't know yours, the person next to you can die. That isn't a figure of speech and nobody treats it like one. Communication was direct and short-fused for the same reason. Nobody has time to be careful with somebody who's supposed to already know. Accountability and ownership weren't values on a poster. They were the floor you stood on.",
      },
      {
        p: "Then I walked into civilian work and brought the tone with me. My assumption was simple and I never once examined it: these people are going to know their job. Why wouldn't they?",
      },
      {
        p: "Out here, nobody dies if the person beside you doesn't know the work. So nothing forces competence to exist in the first place. On the ship, consequence guaranteed it. In a civilian building, somebody has to teach it. I'd never had to teach it, so it never occurred to me that the job was mine.",
      },
      { em: "That's the most expensive assumption I've ever made." },
      {
        p: "The manager above me led through fear and got results, so it looked like proof. That company dangled the carrot and never followed through. You got the pressure and never the payoff. I learned the wrong lesson from a bad example and carried it for years.",
      },
      {
        p: "Training people takes time. It's repetitive, it's unglamorous, and it's boring. But boring is where the magic happens. Saying the same thing the same way for the ninetieth time is the actual job, and it's the only thing that ever made a team of mine better. Fear is faster. It just doesn't compound.",
      },

      { h2: "What changed" },
      {
        p: "Later I ended up around leaders who were just as direct. The expectation was still that you get it done. The difference was they rewarded what they asked for. And I got access to real coaching for the first time. People sat me down and showed me there were other ways to teach somebody than making them afraid of you.",
      },
      { p: "Two things happened when I started leading that way." },
      {
        p: "I started getting results through other people instead of producing everything myself. And my job got easier. Not softer. Easier. I had time to be on the floor, time to support my teams, time to catch problems while they were still small. Fear had been costing me hours I didn't know I was spending.",
      },
      {
        p: "That's what nobody told me at the start. Leading this way saves you time. That's the argument, and it's the one I would have listened to.",
      },

      { h2: "Nobody writes for the floor" },
      {
        p: "Almost everything written about leadership is aimed at the top of the org. Executives, directors, senior managers. People with training budgets and time to read.",
      },
      {
        p: "That's a strange place to aim. The people actually running the work got promoted last month. They're on the floor. They're who a crew looks at when something goes sideways at 6am on a Saturday. They make the business run and they're the least supported people in the building.",
      },
      {
        p: "If the base of the pyramid is weak, nothing above it holds. Strengthen the base and everything above it gets stronger on its own. That's backwards from how most companies spend their development money.",
      },
      {
        p: "There's a second gap underneath that one. Knowing the standard yourself and being able to teach it to somebody else are two different skills. I had the first one early. The second one took me years, because nobody tells you that holding a standard and transmitting a standard require different tools. Most supervisors know exactly what they want. What stops them is not knowing how to say it in a way that lands with the person in front of them.",
      },
      { em: "That gap is why this app exists." },

      { h2: "What I believe" },
      {
        belief: {
          lead: "Standards over motivation.",
          rest: "Speeches wear off by Tuesday. A standard people can see and be held to survives a bad shift.",
        },
      },
      {
        belief: {
          lead: "The standard is the floor, not the ceiling.",
          rest: "It's the minimum of what good looks like. Most people hear a standard and think finish line. Getting somebody to hear it as a starting point is a teaching problem, and it took me longer to learn than anything else on this list.",
        },
      },
      {
        belief: {
          lead: "The standard is the kindness.",
          rest: "Soften it to keep a conversation comfortable and you're borrowing against somebody's future. They pay it back with interest when the real consequence lands.",
        },
      },
      {
        belief: {
          lead: "Results through people, for people.",
          rest: "In that order. The business benefit is real and it's still a side effect. Reverse the order and you manage numbers while losing the crew that produces them.",
        },
      },
      {
        belief: {
          lead: "Find out before you decide.",
          rest: "Somebody failing at a task might not know how to do it. Ask before you apply pressure, and ask well before you move somebody out of a role. I learned that one the expensive way, and so did she.",
        },
      },
      {
        belief: {
          lead: "What they learn here is theirs.",
          rest: "Not their employer's. If somebody uses this, gets better at hard conversations, and then leaves for a better job, or leaves to run their own thing, that's still a win. The skill goes with them.",
        },
      },

      { h2: "What Frontline Coach is" },
      { p: "A system for the conversation you're dreading." },
      {
        p: "Describe what's happening on your shift and get a plan you can run today. Get the words when somebody pushes back while you're standing right there. Rehearse the hard one against an AI employee before you have it for real. Work out whether you're looking at a skill problem, a will problem, or your own. Turn rough notes into a factual record.",
      },
      {
        p: "It won't make you a leader. It'll keep your people from paying for lessons that could have just been taught.",
      },
      {
        p: "If you were promoted recently and nobody trained you, start here.",
        links: [["start here", "/new-manager-coach"]],
      },

      { h2: "What it isn't" },
      {
        p: "It isn't HR and it isn't a lawyer. It doesn't know your company's policies, your union contract, or your state's employment law, and it will never tell you to fire somebody. It organizes your thinking and gives you language. The decision stays yours and your company's process still governs.",
      },
      {
        p: "I built it because the version of me eighteen years ago needed it, and nothing like it existed.",
      },
      { sig: "— B.W. Ryan" },
    ],
  },

  {
    slug: "new-manager-coach",
    navLabel: "You got promoted. Nobody trained you.",
    related: ["employee-pushback", "difficult-employee-conversations", "manager-roleplay"],
    title: "AI Coaching for Newly Promoted Managers and Shift Leads",
    description:
      "Just promoted and nobody trained you? What first-time supervisors get wrong, what to say instead, and the exact words for your first hard conversation.",
    h1: "You Got Promoted. Nobody Trained You.",
    schema: [
      {
        "@type": "Article",
        "@id": `${SITE}/new-manager-coach#article`,
        headline: "You Got Promoted. Nobody Trained You.",
        description:
          "What first-time supervisors get wrong, what works instead, and the words for a first hard conversation.",
        url: `${SITE}/new-manager-coach`,
        author: { "@id": PERSON_ID },
        publisher: { "@id": ORG_ID },
        about: { "@id": APP_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en-US",
        datePublished: "2026-07-27",
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: "B.W. Ryan",
        jobTitle: "Founder",
        url: `${SITE}/operator`,
        worksFor: { "@id": ORG_ID },
      },
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Own The Shift",
        legalName: "OTS Media LLC",
        url: "https://otsowntheshift.com/",
      },
    ],
    blocks: [
      {
        p: "You were good at the work, so they made you the boss of it. That's how almost every frontline promotion happens.",
      },
      {
        p: "Then Saturday comes. Somebody calls off, somebody else is forty minutes behind, and a person you had lunch with last week tells you they're not doing something. Nobody covered this. You're improvising in front of a crew that's watching to see what you do.",
      },
      {
        p: "If that's where you are right now, this is the part nobody sat you down and explained.",
      },

      { h2: "What almost every new supervisor gets wrong" },
      { em: "You try to stay liked." },
      {
        p: "It doesn't feel like a decision. It feels like being reasonable. You let the late arrival slide because they had a rough week. You do the task yourself instead of asking twice. You soften the ask until it sounds like a favour, because you still remember being on that side of it.",
      },
      {
        p: "Every one of those is a small loan against your own authority, and it comes due faster than you'd think. The crew learns which rules are real and which ones depend on your mood. Then when you finally hold the line, it lands as a mood swing instead of a standard, and now you're the boss who changed.",
      },
      {
        p: "The other failure mode is the opposite and it's just as common. You overcorrect, lead through pressure, and get compliance for a month before your best person quits.",
      },
      { p: "Both come from the same place. Nobody taught you the third option." },

      { h2: "What actually works" },
      { em: "Hold the standard. Flex the warmth." },
      {
        p: "The standard is what has to happen. It doesn't move because you like somebody or because it's a bad day. How you say it moves constantly — different person, different history, different day.",
      },
      {
        p: "New supervisors get this backwards. They flex the standard to protect the relationship, when the relationship is exactly what survives a clear standard and what erodes under an unclear one.",
      },
      {
        p: "The standard is also the kindness. People can't hit a target they can't see. Leaving somebody guessing about whether they're doing okay isn't generous — they find out what you actually thought during a review or a termination, which is the worst possible time.",
      },
      {
        p: "And find out before you decide. Somebody failing at a task might just not know how to do it. Nobody may have ever shown them. That question costs you thirty seconds and it changes what the conversation is.",
      },

      { h2: "The one you're dreading: managing people you used to work beside" },
      {
        p: "This is the hardest version and the most common one, because frontline promotions come from inside.",
      },
      {
        p: "Say somebody you're friendly with has been clocking in five to seven minutes late most shifts. Not enough to write up. Enough that the crew has noticed, and enough that two other people have started drifting later too.",
      },
      { p: "Most new supervisors open one of two ways." },
      {
        line: {
          kind: "bad",
          label: "The apology open",
          text: "Hey, I hate to even bring this up, and honestly it's not a big deal, but I've been asked to say something about the clock-in times...",
        },
      },
      {
        p: "You've already lost. You told them it isn't important, you blamed somebody above you, and you left with nothing agreed.",
      },
      {
        line: {
          kind: "bad",
          label: "The hammer open",
          text: "You've been late all week. This is your verbal warning. Fix it or we go to paperwork.",
        },
      },
      {
        p: "You'll get compliance and you'll spend it. That person stops bringing you problems, and you won't notice what that cost until something breaks that you should have heard about a week early.",
      },
      {
        line: {
          kind: "good",
          label: "What works better",
          text: "You've clocked in five or six minutes late four of the last five shifts. I need you here at your start time, ready to go. Is something making that hard?",
        },
      },
      {
        p: "Three things happen in those two sentences. You named the specific observable fact, so there's nothing to argue about. You stated the standard plainly, with no apology and no threat. Then you asked — which gives them room to tell you it's a scheduling problem rather than an attitude problem.",
      },
      {
        p: "You don't need to be tough. You need to be specific, and then you need to stop talking and listen to the answer.",
      },

      { h2: "What happened when Team Leads actually used it" },
      {
        p: "In July 2026, five Team Leads at a multi-site hourly operation used Frontline Coach to prepare one-on-ones. Each picked two of their people. What their General Manager reported back:",
      },
      {
        ul: [
          "It was more useful for coaching conversations than recognition ones. It gave them a structured way to raise a performance problem without the employee feeling like they were just getting in trouble.",
          "It got them asking better questions instead of telling people what to fix. Several said that made the conversations feel collaborative rather than one-way.",
          "One Team Lead used it after an employee pushed back on a request, and said it helped him slow down and think instead of reacting while emotions were high.",
          "Another said it helped him avoid sounding frustrated or aggressive while still communicating urgency.",
          "The more detail they gave it, the more useful the coaching got.",
        ],
      },
      {
        p: "What they didn't like: responses ran too long to read mid-conversation, the language sometimes read as robotic, and it didn't remember previous conversations. All three are now built — shorter streaming responses, a delivery layer for how to say something rather than just what, and memory of who you've coached so a follow-up builds on the last conversation instead of starting cold.",
      },
      { em: "That last one was a Team Lead's suggestion. It shipped." },

      { h2: "How Frontline Coach helps" },
      {
        p: "The gap for most new supervisors isn't knowing what they want. You already know the person should show up on time. The gap is the words, in the moment, with that specific person in front of you.",
      },
      {
        ul: [
          "AI Coach — describe what's happening on your shift and get a plan you can run today, not a framework to study.",
          "Conversation Builder — walk in with your opening line, your observable facts, and the one thing you need different.",
          "Practice — rehearse against an AI employee who pushes back, deflects, and brings up something you didn't plan for. Better there than in the break room.",
          "Pushback Coach — the words when somebody argues while you're standing right there.",
          "Skill vs. Will Diagnostic — work out whether it's a skill problem, a will problem, or yours.",
          "Documentation Assistant — turn rough notes into a clean, factual record.",
        ],
      },
      {
        p: "Free to start. Built by a Navy veteran and eighteen-year frontline operator who learned all of this the wrong way first.",
        links: [["learned all of this the wrong way first", "/operator"]],
      },
      {
        p: "If the conversation you're dreading is someone pushing back on you, there's a whole page on that.",
        links: [["a whole page on that", "/employee-pushback"]],
      },

      { h2: "What it won't do" },
      {
        p: "It isn't HR and it isn't a lawyer. It doesn't know your company's policies, your union contract, or your state's employment law, and it will never tell you to fire somebody or discipline anybody. It organises your thinking and gives you language. Every decision stays yours, and your company's process still governs.",
      },
      {
        p: "It also won't make you a leader in a week. Doing the boring part repeatedly is what does that. This just means the boring part doesn't have to start with you guessing.",
      },

      { h2: "Questions new supervisors actually ask" },
      {
        faq: {
          q: "I just got promoted and I have no idea what I'm doing. Is that normal?",
          a: "Yes, and it's the standard experience rather than a sign you weren't ready. Most frontline promotions come with a new badge and no training. The people who get good at it aren't more natural — they get reps and feedback sooner.",
        },
      },
      {
        faq: {
          q: "How do I manage people who used to be my coworkers?",
          a: "Change the standard first, not the friendship. Be specific and consistent about what has to happen, and don't pretend the promotion didn't happen. The awkward stretch is short. Being unclear to avoid it is what makes it last months.",
        },
      },
      {
        faq: {
          q: "What if somebody doesn't respect me because I'm new or younger?",
          a: "Respect follows predictability more than tenure. If you say what you expect, hold it the same way for everybody, and follow through when you say you will, that resolves faster than any speech about authority.",
        },
      },
      {
        faq: {
          q: "Should I write somebody up or just talk to them first?",
          a: "Talk first, and find out whether they actually know how to do the thing. Plenty of performance problems are training problems wearing a costume. Follow your company's progressive discipline process for anything formal — that process, not this page, is what governs.",
        },
      },
      {
        faq: {
          q: "How do I have a hard conversation without it turning into an argument?",
          a: "Lead with an observable fact instead of a characterisation. \"You clocked in six minutes late four times this week\" is hard to argue with. \"You have an attitude problem\" is an opinion, and people defend themselves against opinions.",
        },
      },
      {
        faq: {
          q: "Is there training for shift leads and first-time supervisors?",
          a: "Very little that's built for the frontline. Most leadership material is written for executives and directors, who have training budgets and time to read. That gap is why this app exists.",
        },
      },
    ],
  },

  {
    slug: "employee-pushback",
    navLabel: "What to say when an employee pushes back",
    related: ["difficult-employee-conversations", "standard-slipping", "manager-roleplay"],
    title: "What to Say When an Employee Pushes Back",
    description:
      "You gave a direction and they pushed. The three things supervisors actually hear, why arguing loses either way, and the words that hold the standard.",
    h1: "What to Say When an Employee Pushes Back",
    schema: [
      {
        "@type": "Article",
        "@id": `${SITE}/employee-pushback#article`,
        headline: "What to Say When an Employee Pushes Back",
        description:
          "The three forms of pushback frontline supervisors actually hear, and what to say to each one.",
        url: `${SITE}/employee-pushback`,
        author: { "@id": PERSON_ID },
        publisher: { "@id": ORG_ID },
        about: { "@id": APP_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en-US",
        datePublished: "2026-07-27",
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: "B.W. Ryan",
        jobTitle: "Founder",
        url: `${SITE}/operator`,
        worksFor: { "@id": ORG_ID },
      },
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Own The Shift",
        legalName: "OTS Media LLC",
        url: "https://otsowntheshift.com/",
      },
    ],
    blocks: [
      {
        p: "You gave a direction. They pushed. And now everybody within earshot has stopped what they're doing to see what you do next.",
      },
      {
        p: "That audience is the part that makes this hard. It isn't really a disagreement about a task anymore. Whatever happens in the next thirty seconds is what your crew will understand the rules to be.",
      },

      { h2: "Both instincts are wrong" },
      {
        p: "The first instinct is to win it. Escalate, pull rank, end it. That works, right now, in front of everyone. What it costs is the person — they stop bringing you problems, and you find out what that cost about a week after something breaks that you should have heard about early.",
      },
      {
        p: "The second instinct is to fold. Drop it, do it yourself, come back to it later. That teaches the crew something more expensive: that the standard is negotiable if you push hard enough. The next person pushes sooner.",
      },
      { em: "Separate the pushback from the task." },
      {
        p: "The task is not negotiable and you handle it now, in one sentence. The pushback is a real thing that needs a real conversation, and it does not happen on the floor with an audience. Almost every bad outcome here comes from trying to do both at once.",
      },

      { h2: "The three things you'll actually hear" },
      {
        p: "Supervisors using Frontline Coach bring the same three situations over and over. They are not variations of each other and they don't take the same response.",
      },

      { h3: "1. \"You never told me that\" — or \"I didn't know that was a rule\"" },
      {
        p: "Start here: it might be true. Not as a courtesy — genuinely. Somebody may have been assumed into a job nobody ever walked them through.",
      },
      {
        line: {
          kind: "bad",
          label: "The trap",
          text: "Yes I did. I told you about this last week, and I told the whole team in the huddle.",
        },
      },
      {
        p: "Now you're arguing about memory. You cannot win that, and winning it wouldn't help — you'd have proved a point and taught them nothing. Worse, you've made the conversation about you.",
      },
      {
        line: {
          kind: "good",
          label: "What works better",
          text: "Fair enough. So we're clear from right now: [the standard]. That's what I need every shift. Anything about it that isn't clear?",
        },
      },
      {
        p: "You gave up nothing. The standard is stated, it's understood, and it starts now. Whether they were told before stopped mattering the moment you decided not to fight about it.",
      },
      {
        p: "Then do the part most supervisors skip. Go find out whether they actually knew. If two or three people don't know a rule, that isn't three attitude problems — it's one training problem, and it's yours. I got this wrong for years, and it cost somebody her job.",
        links: [["cost somebody her job", "/operator"]],
      },

      { h3: "2. \"You're targeting me\"" },
      {
        p: "This one escalates faster than anything else, because it isn't about the task at all. It's an accusation about you, and it usually isn't about today — it's about a pattern they think they've been watching.",
      },
      {
        line: {
          kind: "bad",
          label: "The trap",
          text: "I'm not targeting anybody. I treat everyone exactly the same. I've told other people the same thing.",
        },
      },
      {
        p: "The second you defend yourself, you've agreed to argue as an equal, in public, about your own fairness. There's no version of that you come out of well.",
      },
      {
        line: {
          kind: "good",
          label: "What works better",
          text: "That's a serious thing to say and I'm not going to brush it off. Right now I need [the task] done. Then you and I are sitting down off the floor, and you're going to tell me exactly what you've been seeing — because if I'm being uneven, I need to know.",
        },
      },
      {
        p: "You didn't concede and you didn't defend. You took it seriously, held the immediate standard, and moved the real conversation somewhere it can actually happen.",
      },
      {
        p: "Then keep the appointment, and go in genuinely willing to hear that they're right. Have you corrected other people for this same thing? If you haven't, they are right, and the fastest way to lose a crew is to be the supervisor who only notices some people.",
      },

      { h3: "3. Arguing with you in front of the crew" },
      {
        p: "Sometimes the words aren't the problem. Somebody is dismissive every time they're challenged, and they do it where everyone can hear. One supervisor described exactly this and said the thing that worried him wasn't the employee — it was that the attitude was spreading across the site.",
      },
      {
        p: "He was right to worry about that. Public defiance that goes unanswered isn't one person's behaviour for long.",
      },
      {
        p: "But answering it publicly is how you end up in a shouting match you can't win. Take the audience away instead.",
      },
      {
        line: {
          kind: "good",
          label: "Two moves, in this order",
          text: "I need this done the way we discussed. Walk outside with me for a minute.",
        },
      },
      {
        p: "The first sentence settles it for everyone listening. The second one ends the performance. Nobody gets a show, and you haven't backed down in front of anybody.",
      },
      {
        p: "Then, off the floor, set the standard that actually matters here — not about the task, about where disagreement happens:",
      },
      {
        line: {
          kind: "good",
          label: "The standard worth setting",
          text: "You can disagree with me. I want to know when you think I'm wrong. You can't do it on the floor in front of the crew, because then it isn't a disagreement, it's a contest. Come find me and I'll hear you out every time.",
        },
      },
      {
        p: "That gives them a legitimate route for the thing they actually want, which is to be heard. Most people take it.",
      },

      { h2: "The rule underneath all three" },
      {
        p: "Lead with an observable fact, not a characterisation. \"You told me you weren't doing it, in front of two other people, at four fifteen\" is difficult to argue with. \"You have an attitude problem\" is an opinion, and people defend themselves against opinions with everything they have.",
      },
      {
        p: "This is also why the documentation matters later. Facts survive four months. Your impression of somebody's attitude does not.",
      },

      { h2: "How Frontline Coach helps" },
      {
        p: "Pushback Coach exists for the thirty seconds you don't have. Type what they said, pick your tone, and get words you can use standing right there — not a framework to study later.",
      },
      {
        ul: [
          "Pushback Coach — the response when somebody argues while you're in front of them.",
          "Practice — rehearse against an AI employee who deflects and pushes back, before you do it live.",
          "Conversation Builder — plan the off-the-floor follow-up, which is where these actually get resolved.",
          "Documentation Assistant — turn what happened into a factual record while you still remember it.",
        ],
      },
      {
        p: "Free to start. Built by a Navy veteran and eighteen-year frontline operator.",
        links: [["Navy veteran and eighteen-year frontline operator", "/operator"]],
      },

      { h2: "What it won't do" },
      {
        p: "It isn't HR and it isn't a lawyer. It doesn't know your company's policies, your union contract, or your state's employment law, and it will never tell you to discipline or fire anybody. If pushback involves a safety refusal, a discrimination or harassment claim, or anything protected, stop and go to HR — that is not a coaching conversation. Every decision stays yours and your company's process governs.",
      },

      { h2: "Questions supervisors actually ask" },
      {
        faq: {
          q: "What do I say when an employee says \"that's not my job\"?",
          a: "Handle the task first and the job description later. Something like: \"Right now I need this done. If it's outside what you understood your role to be, come find me after and we'll go through it properly.\" You've held the standard without conceding that the boundary is up for negotiation mid-shift — and if it turns out they're right about the role, you can fix that off the floor.",
        },
      },
      {
        faq: {
          q: "An employee told me I'm targeting them. What do I do?",
          a: "Don't defend yourself in the moment — that turns it into a public argument about your fairness. Take it seriously, hold the immediate standard, and move the conversation off the floor. Then genuinely check whether you've corrected other people for the same thing. If you haven't, they have a point.",
        },
      },
      {
        faq: {
          q: "What if they say nobody ever told them the rule?",
          a: "Assume it might be true and don't argue about the past. State the standard, confirm it's understood, and start it now. Then check whether other people know it either. Several people not knowing a rule is a training gap, not a discipline problem.",
        },
      },
      {
        faq: {
          q: "How do I handle someone arguing with me in front of other employees?",
          a: "Settle the direction in one sentence so everyone listening hears it, then move the conversation off the floor immediately. Don't try to win it publicly. Afterwards, set the standard about where disagreement happens — that they can push back on you, just not in front of the crew.",
        },
      },
      {
        faq: {
          q: "Should I write somebody up for pushing back?",
          a: "Usually not for the pushback itself. Disagreeing with a supervisor isn't misconduct, and writing it up teaches people to go quiet rather than to comply. Refusing a reasonable direction after it's been clearly restated is a different matter — follow your company's progressive discipline process for that.",
        },
      },
      {
        faq: {
          q: "What if I lose my temper?",
          a: "Go back and own it, specifically and without a speech. \"I raised my voice at you on the floor yesterday. That was wrong of me and it won't happen again. The thing I needed hasn't changed.\" Owning it costs you far less authority than pretending it didn't happen, and the crew saw it either way.",
        },
      },
    ],
  },

  {
    slug: "difficult-employee-conversations",
    navLabel: "How to prepare for a difficult conversation",
    related: ["manager-roleplay", "manager-documentation", "employee-pushback"],
    title: "How to Prepare for a Difficult Employee Conversation",
    description:
      "You've been putting it off and it got worse. How to plan a hard conversation in three parts, what to say, and what to do when you already had it once.",
    h1: "How to Prepare for a Difficult Employee Conversation",
    schema: [
      {
        "@type": "Article",
        "@id": `${SITE}/difficult-employee-conversations#article`,
        headline: "How to Prepare for a Difficult Employee Conversation",
        description:
          "Planning a hard conversation in three parts, and what to do when the first one didn't work.",
        url: `${SITE}/difficult-employee-conversations`,
        author: { "@id": PERSON_ID },
        publisher: { "@id": ORG_ID },
        about: { "@id": APP_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en-US",
        datePublished: "2026-07-27",
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: "B.W. Ryan",
        jobTitle: "Founder",
        url: `${SITE}/operator`,
        worksFor: { "@id": ORG_ID },
      },
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Own The Shift",
        legalName: "OTS Media LLC",
        url: "https://otsowntheshift.com/",
      },
    ],
    blocks: [
      {
        p: "You've known about it for two weeks. You've rehearsed it in your head in the truck. You've almost started it twice and found a reason not to.",
      },
      {
        p: "Meanwhile it got worse, other people noticed, and now the conversation is bigger than it needed to be. That's the real cost of putting it off — not that the problem grows, but that the conversation does.",
      },

      { h2: "Three ways supervisors get this wrong" },
      {
        p: "The first is winging it. You know roughly what you want to say, you trust yourself to find the words, and then they say something you didn't expect and you're improvising about somebody's job.",
      },
      {
        p: "The second is over-preparing into a script. You write it out, you deliver it, and it comes out sounding like a statement being read into a record. They can hear that it's rehearsed, which tells them this is a procedure rather than a conversation, and they respond accordingly.",
      },
      {
        p: "The third is the compliment sandwich, and it's the most common piece of bad advice in management. Praise, criticism, praise. Everybody over the age of twenty recognises it, and all it does is teach people that your compliments are a warning sign. It also buries the one thing you needed them to hear in the middle of the two things you didn't.",
      },

      { h2: "Plan three things, not a script" },
      {
        p: "You need to walk in knowing three things. Not sentences to recite — decisions to have already made.",
      },
      {
        ul: [
          "Your opening line. The first sentence, word for word. This is the only part worth memorising, because it's the part you'll fumble under pressure and it sets the temperature for everything after.",
          "Your observable facts. Specific, dated, what you saw or heard. Not your interpretation of it.",
          "The one thing you need different. One. If you have four, pick the one that matters most and save the rest.",
        ],
      },
      {
        p: "Everything else you handle live, because you can't plan their half of it and pretending you can is what makes you brittle.",
      },

      { h2: "What that sounds like" },
      {
        p: "Take a real one: somebody who's been on the job a few months has started drifting. Tasks half done, corners cut, nothing dramatic.",
      },
      {
        line: {
          kind: "bad",
          label: "Winging it",
          text: "Hey, so, I've been meaning to talk to you — I feel like maybe the effort hasn't quite been there lately? I don't know, maybe it's just me, but it seems like something's off.",
        },
      },
      {
        p: "Nothing here is arguable because nothing here is specific. You've told them you're unhappy and given them no idea what to do about it. Most people leave this conversation anxious and unchanged.",
      },
      {
        line: {
          kind: "good",
          label: "Planned",
          text: "I want to talk about the closing routine. Tuesday and Thursday the back area wasn't wiped down and the mats didn't get pulled. Two months ago that wasn't happening. What's changed?",
        },
      },
      {
        p: "Specific, dated, observable. It names the standard by implication rather than lecture. And it ends with a real question instead of a verdict, which is what turns it into a conversation rather than a delivery.",
      },
      {
        p: "Then stop talking. The silence after that question is the most useful part of the whole exchange and it will feel unbearable. Let it sit.",
      },

      { h2: "The one nobody writes about: you already had this conversation" },
      {
        p: "This is the most common thing supervisors bring to Frontline Coach, and it's almost absent from the leadership writing out there. You had the conversation. They agreed. Nothing changed.",
      },
      {
        p: "The instinct is to have the same conversation again, louder. Don't. Repeating it teaches them that the conversation is the consequence — and a conversation they've already survived once isn't much of a consequence.",
      },
      {
        p: "The second one is a different conversation. It has to name the fact that there was a first one.",
      },
      {
        line: {
          kind: "good",
          label: "The second conversation",
          text: "We talked about this on the twelfth and you told me you'd have it handled. It's the same today. So either something is in the way that I don't know about, or this isn't a priority for you. I need to know which, because those have different answers.",
        },
      },
      {
        p: "That question is genuine and you have to be willing to hear either answer. If something is in the way — they don't actually know how to do part of it, the schedule makes it impossible, something at home — then you have a problem you can solve. If it isn't a priority for them, you have a different problem, and it now needs a date and a consequence attached rather than another chat.",
      },
      {
        p: "Ask about the barrier before you assume the attitude. I spent years assuming the attitude, and it cost people their jobs when the real answer was that nobody had ever shown them how.",
        links: [["cost people their jobs", "/operator"]],
      },

      { h2: "Rehearse it against resistance" },
      {
        p: "The reason planning fails is that you rehearse in your head, and in your head they agree with you. In reality they get defensive, or deflect, or bring up something from four months ago you'd forgotten about.",
      },
      {
        p: "The first time you say these words out loud should not be to the person they're about.",
        links: [],
      },

      { h2: "How Frontline Coach helps" },
      {
        ul: [
          "Conversation Builder — turns what you're dealing with into an opening line, your observable facts, and the one thing you need different.",
          "Practice — rehearse it against an AI employee who pushes back and deflects, so the real one isn't the first attempt.",
          "Skill vs. Will Diagnostic — for exactly the second-conversation problem: is it a skill gap, a motivation gap, or something you caused.",
          "Pushback Coach — for when it goes sideways mid-conversation.",
          "Documentation Assistant — turn it into a factual record afterwards, while you still remember what was said.",
        ],
      },
      {
        p: "Free to start. Built by a Navy veteran and eighteen-year frontline operator.",
        links: [["Navy veteran and eighteen-year frontline operator", "/operator"]],
      },

      { h2: "What it won't do" },
      {
        p: "It isn't HR and it isn't a lawyer. It doesn't know your company's policies, your union contract, or your state's employment law, and it will never tell you to discipline or terminate anybody. If the conversation touches a medical issue, a disability, a leave request, harassment, or anything protected, stop and go to HR before you have it. Every decision stays yours and your company's process governs.",
      },

      { h2: "Questions supervisors actually ask" },
      {
        faq: {
          q: "How do I tell an employee they need to improve?",
          a: "Lead with a specific, dated observation rather than a judgement, then ask a real question. \"Tuesday and Thursday the closing checklist wasn't finished. Two months ago that wasn't happening. What's changed?\" Name one thing you need different, not four, and stop talking after the question.",
        },
      },
      {
        faq: {
          q: "I keep putting off a hard conversation. How do I actually start it?",
          a: "Write your first sentence and nothing else. Most avoidance is about the opening, not the conversation — once you're twenty seconds in, you'll handle it. Then pick a time today. The cost of waiting isn't that the problem grows, it's that the conversation does.",
        },
      },
      {
        faq: {
          q: "What if I already talked to them and nothing changed?",
          a: "Don't repeat the first conversation. Name that there was one, then ask whether something is in the way or whether this isn't a priority for them, because those have different answers. If it's a barrier, solve it. If it isn't, the next step needs a date and a consequence rather than another conversation.",
        },
      },
      {
        faq: {
          q: "How do I talk to an employee about their attitude?",
          a: "Don't talk about the attitude — talk about the behaviour that made you call it an attitude. \"You have an attitude problem\" is an opinion and people defend themselves against opinions. \"When I asked you to redo the mats you rolled your eyes and walked away\" is a fact, and it's about something they can actually change.",
        },
      },
      {
        faq: {
          q: "Should I use the compliment sandwich?",
          a: "No. Everybody recognises it, and the only lasting effect is that your compliments start to read as a warning. If somebody deserves praise, give it on its own another day so it means something. If you need to raise a problem, raise the problem.",
        },
      },
      {
        faq: {
          q: "Should I have this conversation in front of other people?",
          a: "No. Take it off the floor, even if it's just outside or in the back for two minutes. An audience turns a correction into a performance, and it forces the other person to defend their standing in front of their coworkers instead of listening to you.",
        },
      },
    ],
  },

  {
    slug: "standard-slipping",
    navLabel: "When one person's slipping starts spreading",
    related: ["difficult-employee-conversations", "employee-pushback", "manager-documentation"],
    title: "When One Person's Slipping Starts Spreading",
    description:
      "Your best performer is quietly skipping a step and now the crew is too. Why blanket reminders fail, and how to fix the standard without punishing everyone.",
    h1: "When One Person's Slipping Starts Spreading",
    schema: [
      {
        "@type": "Article",
        "@id": `${SITE}/standard-slipping#article`,
        headline: "When One Person's Slipping Starts Spreading",
        description:
          "How a single unaddressed shortcut becomes the crew's new normal, and what to do about it.",
        url: `${SITE}/standard-slipping`,
        author: { "@id": PERSON_ID },
        publisher: { "@id": ORG_ID },
        about: { "@id": APP_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en-US",
        datePublished: "2026-07-27",
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: "B.W. Ryan",
        jobTitle: "Founder",
        url: `${SITE}/operator`,
        worksFor: { "@id": ORG_ID },
      },
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Own The Shift",
        legalName: "OTS Media LLC",
        url: "https://otsowntheshift.com/",
      },
    ],
    blocks: [
      {
        p: "A supervisor described this almost word for word: his assistant manager is excellent with customers, genuinely liked, and keeps letting the closing checklist slide. The team has started copying him and skipping steps too.",
      },
      {
        p: "If you've got a version of that, you don't have a checklist problem. You have a crew that has learned which parts of the job are optional, and they learned it by watching somebody get away with it.",
      },

      { h2: "Why this one sits unaddressed for months" },
      {
        p: "Because the person is good. That's the whole reason.",
      },
      {
        p: "If they were bad at the job you'd have dealt with it. But they're strong where it's visible — customers love them, they show up, they carry the shift — so raising a back-of-house checklist feels petty. Ungrateful, even. So you let it go, and then you let it go again, and by the third month you'd have to explain why you're bringing up something you clearly haven't minded for a quarter.",
      },
      { em: "The standard is the floor, not the ceiling." },
      {
        p: "Being excellent at the visible part of the job doesn't buy an exemption from the rest of it. That isn't harshness — it's the only version of fair that survives contact with a crew who can see what's happening.",
      },

      { h2: "The mistake: talking to everybody" },
      {
        p: "Here's what almost everyone does. They bring it up in the huddle. \"Team, we need to be better about closing procedures.\" General, blameless, nobody singled out.",
      },
      {
        p: "It fails every time, for three reasons.",
      },
      {
        ul: [
          "The people already doing it right hear that they're being criticised for something they didn't do. That's the fastest way to lose your best people's respect.",
          "The person actually responsible either doesn't realise it's about them, or knows exactly that it is and now knows you won't say it to their face.",
          "The crew watches you address a specific person's behaviour by talking to a room. They draw the obvious conclusion about what you'll do when it's them.",
        ],
      },
      {
        p: "A blanket reminder is a way of having a hard conversation without having it. It feels like leadership and it costs you more than doing nothing.",
      },

      { h2: "Go to the source first, and privately" },
      {
        p: "Start with the person, off the floor, and be specific about both halves — the thing itself and the fact that it's spreading.",
      },
      {
        line: {
          kind: "good",
          label: "The conversation",
          text: "You're the best person I've got with customers and I'm not being cute when I say that. And the closing checklist hasn't been finished on your shifts eight of the last ten. Here's why I'm raising it now: two other people have stopped doing it too, and they didn't decide that on their own. They're following you. I need the checklist done, and I need it done by you specifically, because they're watching what you do more than they're listening to what I say.",
        },
      },
      {
        p: "That last part is the whole conversation. You're not accusing them of poor performance — you're telling them their influence is real and currently pointed the wrong way. For somebody who's good at their job and knows it, that lands differently than a correction does. Most people in that position are quietly proud of the influence and hadn't thought about which direction it was going.",
      },

      { h2: "Then reset the standard, without a manhunt" },
      {
        p: "Once the source is handled, you can re-state the standard to the group — but do it as a standard going forward, not as a complaint about the past, and never in a way that invites people to work out who it was about.",
      },
      {
        line: {
          kind: "good",
          label: "To the crew",
          text: "Closing checklist gets completed and initialled every shift, starting tonight. If something on it doesn't make sense or takes too long, tell me and I'll look at it. But until it changes, it gets done.",
        },
      },
      {
        p: "Note the middle sentence. Half of all quietly abandoned procedures are abandoned because they're genuinely stupid, and nobody felt able to say so. Opening that door costs you nothing and occasionally saves you from defending a step that shouldn't exist.",
      },

      { h2: "How to tell it's already spread" },
      {
        p: "Some tells, in roughly the order they show up:",
      },
      {
        ul: [
          "You find yourself checking whether something got done instead of assuming it did.",
          "The shortcut has a name. Somebody has started calling it something, which means it's now a practice rather than a lapse.",
          "New hires are doing it. That's the serious one — it means the shortcut is being taught, and it's the crew's standard now, not yours.",
          "Somebody asks whether they still have to do it. That's not insubordination, that's an honest question about what the real rule is.",
        ],
      },
      {
        p: "Once new people are learning the shortcut as the way, you're not correcting a person any more. You're re-establishing a standard, and that takes longer than the conversation you should have had in month one.",
      },

      { h2: "How Frontline Coach helps" },
      {
        ul: [
          "AI Coach — describe the situation, including that it's spreading, and get a plan for the specific person and the crew reset.",
          "Conversation Builder — plan the hard half: raising a problem with somebody who's genuinely good at their job.",
          "Practice — rehearse it, because this one goes wrong when the person you respect gets defensive and you back off.",
          "Skill vs. Will Diagnostic — work out whether the step is being skipped because it's unclear, because it's badly designed, or because nobody's been asked to do it.",
        ],
      },
      {
        p: "Free to start. Built by a Navy veteran and eighteen-year frontline operator.",
        links: [["Navy veteran and eighteen-year frontline operator", "/operator"]],
      },

      { h2: "What it won't do" },
      {
        p: "It isn't HR and it isn't a lawyer. It doesn't know your company's policies, your union contract, or your state's employment law, and it will never tell you to discipline or demote anybody. If the skipped step is a safety or compliance requirement, treat it as that first and follow your company's process — that is not a coaching conversation. Every decision stays yours.",
      },

      { h2: "Questions supervisors actually ask" },
      {
        faq: {
          q: "My best employee keeps skipping a step and now others are too. What do I do?",
          a: "Go to them privately and name both halves: the step, and the fact that people are following them. Frame it as influence rather than performance — they're good, people watch them, and right now that's working against the standard. Then reset the standard with the crew as a going-forward rule, not a complaint about the past.",
        },
      },
      {
        faq: {
          q: "Should I just remind the whole team instead of calling one person out?",
          a: "No. Blanket reminders criticise the people doing it right, let the responsible person off the hook, and show the crew you won't address things directly. Handle the source privately first, then state the standard to the group without making it a guessing game about who it was about.",
        },
      },
      {
        faq: {
          q: "How do I correct someone who's better at parts of the job than I am?",
          a: "Say that out loud first, because it's true and they know it. Then be specific about the gap. Being excellent at one part of the job doesn't exempt anybody from the rest, and a good performer can hear that when it's said plainly and without you pretending to be superior.",
        },
      },
      {
        faq: {
          q: "What if the step they're skipping is genuinely pointless?",
          a: "That's worth finding out, and asking costs you nothing. Plenty of abandoned procedures were abandoned because they don't make sense and nobody felt able to say so. Hold the standard until it changes, but be honest that you'll look at it — then actually look at it.",
        },
      },
      {
        faq: {
          q: "How long do I have before it becomes the new normal?",
          a: "The clearest marker is new hires. Once somebody who joined after the drift is doing it too, the shortcut is being taught rather than tolerated, and you're re-establishing a standard rather than correcting a person. That takes considerably longer.",
        },
      },
    ],
  },

  {
    slug: "manager-roleplay",
    navLabel: "Practise the conversation before you have it",
    related: ["difficult-employee-conversations", "new-manager-coach", "pricing"],
    title: "AI Roleplay for Difficult Manager Conversations",
    description:
      "Rehearsing in your head doesn't work, because in your head they agree with you. Practise against an AI employee who pushes back before you do it live.",
    h1: "Practise the Conversation Before You Have It",
    schema: [
      {
        "@type": "Article",
        "@id": `${SITE}/manager-roleplay#article`,
        headline: "Practise the Conversation Before You Have It",
        description:
          "Why mental rehearsal fails and what practising against realistic resistance actually changes.",
        url: `${SITE}/manager-roleplay`,
        author: { "@id": PERSON_ID },
        publisher: { "@id": ORG_ID },
        about: { "@id": APP_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en-US",
        datePublished: "2026-07-27",
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: "B.W. Ryan",
        jobTitle: "Founder",
        url: `${SITE}/operator`,
        worksFor: { "@id": ORG_ID },
      },
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Own The Shift",
        legalName: "OTS Media LLC",
        url: "https://otsowntheshift.com/",
      },
    ],
    blocks: [
      {
        p: "This is for shift leads, supervisors and managers rehearsing a conversation with an employee. If you landed here looking for sales call practice, this isn't that — there's a separate product with a similar name that does sales and customer experience roleplay.",
      },
      {
        p: "Here it's the conversation you're dreading with somebody on your crew.",
      },

      { h2: "Rehearsing in your head doesn't work" },
      {
        p: "Everybody rehearses. In the truck on the way in, in the shower, lying awake at two in the morning. And it feels like preparation.",
      },
      { em: "The problem is that in your head, they agree with you." },
      {
        p: "You deliver your line, imaginary-them nods, accepts the point, and says they'll fix it. You run that a few times, feel ready, and walk in. Then the real person gets defensive, or goes quiet, or says \"you never told me that,\" or brings up something from four months ago that you'd completely forgotten — and none of your rehearsal covered any of it, because you were the one writing their lines.",
      },
      {
        p: "You didn't practise the conversation. You practised your half of a conversation that was never going to happen.",
      },

      { h2: "What practising against resistance changes" },
      {
        p: "Three things, and the third is the one that matters most.",
      },
      {
        ul: [
          "You find out where your opening lands wrong. Most bad conversations are decided in the first sentence, and you can't hear how yours sounds until something responds to it.",
          "You get the deflections out of the way. If somebody's going to say \"nobody told me,\" better the first time you hear it is in practice, where you can think for ten seconds instead of two.",
          "You stop needing the script. Once you've been knocked off your plan a few times and found your way back, you're not delivering a rehearsed piece any more — you're having a conversation with a standard you're clear about. That's the actual goal, and it's the opposite of what over-preparation produces.",
        ],
      },

      { h2: "What a session looks like" },
      {
        p: "You describe the situation in your own words — the same way you'd tell a colleague. Then you talk to an AI employee who behaves like the person you described, and you go at it.",
      },
      {
        line: {
          kind: "plain",
          label: "You set it up",
          text: "My prep has been clocking in five or six minutes late most shifts. She's friendly, she's been here longer than I have, and I got promoted over her four months ago.",
        },
      },
      {
        line: {
          kind: "plain",
          label: "You open",
          text: "Hey, can I grab you for a second? I wanted to talk about start times.",
        },
      },
      {
        line: {
          kind: "plain",
          label: "The AI employee",
          text: "Sure. Is this about the clock thing? Because I've been covering the end of Marcus's shift half the week and nobody's said anything about that.",
        },
      },
      {
        p: "There it is. That's the move you didn't plan for — a deflection that also happens to contain a legitimate point. In your head she said \"sorry, I'll fix it.\" Here you have to decide in real time whether to hold the line, address the Marcus thing, or do both and in which order.",
      },
      {
        p: "Get that wrong in practice and it costs you nothing. Get it wrong live and you've either dismissed something real or lost the thread entirely.",
      },

      { h2: "The ones worth rehearsing" },
      {
        p: "Not everything needs practice. These do:",
      },
      {
        ul: [
          "Anything where you're nervous about your own reaction. If you think you might get short with somebody, rehearse it.",
          "Managing a former peer, especially somebody you were promoted over.",
          "The second conversation, when the first one didn't work and you can't just repeat it.",
          "Anything you've been putting off for more than a week. The avoidance is usually about the opening, and practice kills that specifically.",
          "Your first few conversations as a new supervisor, full stop.",
        ],
      },
      {
        p: "Recognition conversations, for what it's worth, mostly don't need it. If somebody did well, tell them. That one doesn't go sideways.",
      },

      { h2: "How it's different from asking a chatbot" },
      {
        p: "You can ask any AI what to say to a late employee and get reasonable advice. What you can't easily get is something that stays in character as a specific difficult person while you fumble, pushes back the way a frontline employee actually pushes back, and holds the thread across a whole conversation instead of handing you a bulleted list.",
      },

      { h2: "And how it's different from roleplay tools built for office managers" },
      {
        p: "There are good conversation-practice tools aimed at managers in tech and professional services. Their scenarios are things like managing up, negotiating scope, and running a performance review cycle. If that's your job, use one of those.",
      },
      {
        p: "This is built for hourly frontline supervision, and the conversations are not the same. Somebody clocking in late four shifts running. A prep who says \"that's not my job\" in front of two coworkers. A closing checklist quietly going unfinished until the whole crew stops doing it. An employee who tells you you're targeting them. Nobody on a floor at 6am is negotiating scope creep.",
      },
      {
        p: "The vocabulary matters more than it sounds like it should. A rehearsal partner that talks like a product manager doesn't prepare you for a conversation with somebody who has been on their feet for nine hours.",
      },
      {
        p: "Frontline Coach also remembers who you've coached and what you covered, so the follow-up two weeks later builds on the last conversation rather than starting from nothing. That was a Team Lead's suggestion and it shipped.",
      },

      { h2: "How Frontline Coach helps" },
      {
        ul: [
          "Practice — rehearse against an AI employee that stays in character and pushes back.",
          "Conversation Builder — plan the three things first, then take them into practice.",
          "Pushback Coach — for when the live version goes somewhere you didn't rehearse.",
          "Documentation Assistant — turn the real conversation into a factual record afterwards.",
        ],
      },
      {
        p: "Free to start. Built by a Navy veteran and eighteen-year frontline operator.",
        links: [["Navy veteran and eighteen-year frontline operator", "/operator"]],
      },

      { h2: "What it won't do" },
      {
        p: "It isn't HR and it isn't a lawyer, and an AI employee isn't your employee. It rehearses your delivery and your thinking — it can't predict what a specific person will actually say. If the conversation touches a medical issue, a disability, a leave request, harassment, or anything protected, stop and go to HR rather than practising your way into it. Every decision stays yours and your company's process governs.",
      },

      { h2: "Questions supervisors actually ask" },
      {
        faq: {
          q: "How do I practise a difficult conversation with an employee?",
          a: "Describe the situation and the person in your own words, then have the conversation out loud against something that responds in character. The point is to get knocked off your plan and find your way back, so practise against resistance rather than agreement. Rehearsing in your head doesn't work because you write both halves.",
        },
      },
      {
        faq: {
          q: "Isn't roleplaying with an AI a bit awkward?",
          a: "The first two minutes are. Then you're arguing with it, which is the point. It's considerably less awkward than discovering mid-conversation with a real person that your opening line came out wrong.",
        },
      },
      {
        faq: {
          q: "How many times should I practise before the real conversation?",
          a: "Usually two or three. Once to find out your opening is wrong, once to handle the deflection you didn't expect, and once that goes reasonably. Beyond that you start memorising, which makes you sound rehearsed and brittle when the real person goes off-script.",
        },
      },
      {
        faq: {
          q: "Can I practise firing someone?",
          a: "You can rehearse how you'll speak and how you'll hold up. But termination is a process question before it's a conversation question, and it needs to run through HR and your company's policy first. Practise the delivery, not the decision.",
        },
      },
      {
        faq: {
          q: "Is this the same as sales roleplay software?",
          a: "No. This is for supervisors having conversations with their own employees about performance, attendance, attitude and conduct. Sales roleplay tools train reps to handle buyers and objections — different audience, different conversation, and there's a separate product with a similar name that does exactly that.",
        },
      },
      {
        faq: {
          q: "How is this different from conversation practice tools for corporate managers?",
          a: "Audience and vocabulary. Tools built for tech and professional-services managers cover managing up, scope negotiation and review cycles. This covers attendance, attitude, pushback on the floor, a standard slipping across a crew, and documentation afterwards. If your hard conversations happen in a conference room, use one of those. If they happen in a break room with somebody who's been standing for nine hours, use this.",
        },
      },
      {
        faq: {
          q: "Can I practise out loud instead of typing?",
          a: "Not yet — sessions are text today. Voice is on the roadmap, and it matters more for this audience than most: a supervisor on a floor can usually talk when they can't easily type. It'll land as a paid feature, because voice costs meaningfully more per minute to run than text.",
        },
      },
    ],
  },

  {
    slug: "pricing",
    navLabel: "Pricing",
    related: ["new-manager-coach", "manager-roleplay", "operator"],
    title: "Pricing — Frontline Coach by Own The Shift",
    description:
      "Seven days free with no card, then $14.99 a month or $119 a year. The first 100 subscribers lock $7.99 for good. Priced for frontline supervisors.",
    h1: "Pricing",
    schema: [
      {
        "@type": "WebPage",
        "@id": `${SITE}/pricing#page`,
        url: `${SITE}/pricing`,
        name: "Pricing — Frontline Coach by Own The Shift",
        about: { "@id": APP_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en-US",
      },
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Own The Shift",
        legalName: "OTS Media LLC",
        url: "https://otsowntheshift.com/",
      },
    ],
    blocks: [
      {
        em: "Seven days free. No card up front, no limits while you're trying it.",
      },
      {
        p: "Every tool is open for those seven days and nothing is rationed. You don't enter a card to start, so there's no renewal to cancel and nothing happens automatically at the end — you decide, or you walk away.",
      },

      { h2: "After the seven days" },
      {
        // Do not reintroduce "Seven days free, then…" here. This section used to be
        // "After the beta", so it had to introduce the trial. The trial is now the
        // page's lead sentence, and saying it twice in the first two paragraphs read
        // like a page that had been edited around a deleted idea — which it had.
        p: "$14.99 a month, or $119 a year. You sign up, you use it for a week, and you decide at the end. If it hasn't earned it by then, walk away and nothing happens.",
      },
      {
        p: "Seven days rather than thirty because of how this actually gets used. Nobody opens a coaching app daily; you open it when something happens on a shift, which is two or three times a week. A week is long enough to hit two or three real situations and see whether the app helped. A month is long enough to forget you signed up.",
      },

      { h2: "What's included" },
      {
        p: "Every tool for handling the conversation in front of you. Nothing about the thing you actually came here for is held back or unlocked separately, because a coaching tool that withholds the tool you need at 6am on a Saturday isn't worth paying for.",
      },
      {
        ul: [
          "Describe a people problem on your shift and get a plan you can run today",
          "The exact words when somebody pushes back while you're standing there",
          "Rehearse a hard conversation against an AI employee who argues back",
          "Plan a conversation start to finish, with the opening line written out",
          "Work out whether it's a skill problem, a will problem, or yours",
          "Turn rough notes into a clean, factual record",
          "Remembers who you've coached and what you covered, so follow-ups build on the last talk",
          "Speaks your industry's language — restaurant, retail, warehouse, hospitality, healthcare, field service, car wash, or any frontline team",
        ],
      },
      {
        // Date moved from 15 November to 1 October on 2 Sep 2026. The enforcing code reads
        // it from src/lib/plans.js; this sentence is the promise the code has to keep, so
        // if that constant moves again, this moves with it.
        p: "A second plan for running a team over time — one-on-one prep built from your own history with someone, and tracking on what you said you'd follow up — is Premium, at $24.99 a month or $199 a year. Both tools, and the practice voice, are open to everyone until 1 October. Saying so now rather than surprising anyone later.",
      },
      {
        p: "Fair use applies rather than a hard ceiling: role play runs on a heavier model that stays in character properly, so it costs real money to serve. Use it like a supervisor and you'll never notice a limit.",
      },

      { h2: "Founding members" },
      {
        // Raised from thirty to 100 on 1 Sep 2026, when the iOS app was approved and
        // signups opened nationally. "First 100 to SUBSCRIBE" — not to sign up. The
        // wording matters and is enforced that way: the slot is claimed by the Stripe
        // webhook when a payment succeeds, never at registration. See
        // supabase/migrations/20260901000002_founding_on_purchase.sql.
        p: b(
          "The first 100 people to subscribe get $7.99 a month, locked for as long as they stay subscribed. Not a first-year discount — the rate holds.",
          "The first 100 members to subscribe get $7.99 a month, locked for as long as they stay subscribed. Not a first-year discount — the rate holds."
        ),
      },
      {
        p: "Being straight about what that covers: Founding locks the Standard price, and Standard is what you get — Premium tools stay on the Premium plan. If we add a higher tier later it'll be separate, and this rate won't include it. Better you know that now than feel misled down the line.",
      },
      {
        p: "Cancel and the rate goes with you — you'd rejoin at $14.99. That's the trade for a price nobody else gets.",
      },

      { h2: "Questions about paying" },
      {
        faq: {
          q: "Do I need a credit card to start?",
          a: "No. Signing up takes an email address or a Google account and nothing else. The seven days run without a card on file, and you only enter payment details if you decide to carry on at the end.",
        },
      },
      {
        faq: {
          q: "What happens at the end of the seven days?",
          a: "The tools stop and you're asked whether you want to continue. Nothing is deleted — your conversations, your history and everything the app remembers about your people stay exactly where they are. Subscribe later and it's all still there.",
        },
      },
      {
        faq: {
          q: "Is $14.99 per person or per location?",
          a: "Per person. One supervisor, one account. There's no team plan yet — if you want to put a whole management group on it, get in touch and we'll work something out rather than making you buy seats one at a time.",
        },
      },
      {
        faq: {
          q: "Will my company pay for this?",
          a: "Some will, plenty won't, and it's built so you don't need permission. Everything you learn is yours and goes with you if you change jobs. If you do want your employer to cover it, the yearly plan at $119 is usually easier to get approved than a monthly subscription.",
        },
      },
      {
        faq: {
          q: "Can I cancel?",
          a: "Any time, and you keep access until the end of the period you paid for. No cancellation flow designed to wear you down. One thing to know: if you're on the founding rate, cancelling gives it up permanently.",
        },
      },
      {
        faq: {
          q: "Why only seven days?",
          a: "Because a coaching app isn't used daily — you open it when something happens on a shift, two or three times a week. Seven days is long enough to hit two or three real situations and find out whether it helped. Thirty days is long enough to sign up, forget, and get charged for something you never opened.",
        },
      },
      {
        faq: {
          q: "What do I actually get in the seven days?",
          a: "All of it, unrationed — every tool, the full model, no metering. A trial that hands you a hobbled version tells you nothing about whether the real thing is worth $14.99, so you get the real thing.",
        },
      },
    ],
  },

  {
    slug: "manager-documentation",
    navLabel: "How to document an employee conversation",
    related: ["difficult-employee-conversations", "standard-slipping", "operator"],
    title: "How Managers Document Employee Conversations Factually",
    description:
      "Four months from now it matters and your memory is a feeling. How to write observable facts instead of opinions, and where documentation stops being yours.",
    h1: "How to Document an Employee Conversation",
    schema: [
      {
        "@type": "Article",
        "@id": `${SITE}/manager-documentation#article`,
        headline: "How to Document an Employee Conversation",
        description:
          "Writing observable facts rather than conclusions, and the guardrails around manager documentation.",
        url: `${SITE}/manager-documentation`,
        author: { "@id": PERSON_ID },
        publisher: { "@id": ORG_ID },
        about: { "@id": APP_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en-US",
        datePublished: "2026-07-27",
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: "B.W. Ryan",
        jobTitle: "Founder",
        url: `${SITE}/operator`,
        worksFor: { "@id": ORG_ID },
      },
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Own The Shift",
        legalName: "OTS Media LLC",
        url: "https://otsowntheshift.com/",
      },
    ],
    blocks: [
      {
        p: "Read this part first, because it shapes everything else on the page.",
      },
      {
        p: "This is about writing down what happened accurately. It is not legal advice, it isn't a substitute for your company's disciplinary process, and nothing here tells you what action to take. Your HR team and your company's policy decide that. What follows is about the quality of the record itself.",
      },

      { h2: "Why the record matters" },
      {
        p: "Something happens on a Tuesday. You handle it, it goes fine, you move on. Four months later it matters — a pattern, a promotion decision, a termination, occasionally a claim — and what you have is a feeling. You remember being frustrated. You don't remember the date, the words, or who else was standing there.",
      },
      {
        p: "A feeling is not a record. And the version of events you reconstruct four months later will be shaped by how you feel about that person now, which is exactly the thing documentation is supposed to protect against.",
      },

      { h2: "The mistake: writing conclusions" },
      {
        p: "Almost every weak note has the same flaw. It records what the supervisor concluded rather than what the supervisor observed.",
      },
      {
        line: {
          kind: "bad",
          label: "A conclusion",
          text: "Spoke with employee about ongoing attitude problem and lack of respect for authority. Employee was defensive and uncooperative. Will continue to monitor.",
        },
      },
      {
        p: "Every load-bearing word there is an opinion. Attitude problem, lack of respect, defensive, uncooperative — those are your interpretations, and none of them can be verified by anybody who wasn't in your head. If that note is ever read by someone who wasn't there, it tells them about you rather than about the employee.",
      },
      {
        line: {
          kind: "good",
          label: "An observation",
          text: "22 July, approx. 4:15pm. I asked [employee] to redo the mats in bay two. He said \"I already did those, do them yourself,\" and walked to the break room. Two other team members were within hearing distance. I followed up at 4:30pm off the floor and restated that mats are part of the closing routine. He said he understood. Mats were completed by end of shift.",
        },
      },
      {
        p: "Nothing there is arguable. Date, time, what was asked, what was said in quotes, who could hear it, what you did next, how it ended. Anybody reading it four months from now sees the same event you saw.",
      },

      { h2: "What belongs in a note" },
      {
        ul: [
          "Date and approximate time. Both, always. \"Last week\" is worthless in four months.",
          "What you asked or observed, specifically.",
          "What was said, in quotation marks where you're confident of the words. If you're paraphrasing, say so.",
          "Who else was present or within earshot.",
          "What you did about it, and what was agreed.",
          "The outcome, if there was one by end of shift.",
        ],
      },
      {
        p: "Write it the same day. Not because of any rule — because your recall of the actual words is gone by tomorrow, and approximate quotes are worse than no quotes.",
      },

      { h2: "What to keep out" },
      {
        ul: [
          "Characterisations. Attitude, lazy, disrespectful, difficult, bad fit. All conclusions.",
          "Speculation about why. You don't know what's going on in somebody's life and guessing in writing is how a note becomes evidence against you.",
          "Anything medical, or anything about a disability, pregnancy, religion, or family situation. If that's genuinely relevant, it belongs with HR and not in your notes.",
          "Sarcasm and editorialising. It reads exactly as badly as you'd expect when someone else reads it later.",
          "Comparisons to other employees by name.",
        ],
      },
      {
        p: "The test is simple. Could a stranger read this note and see the event rather than your opinion of the person? If not, rewrite it.",
      },

      { h2: "Where this stops being yours" },
      {
        p: "Documentation is a supervisor's job. Deciding what happens next mostly isn't.",
      },
      {
        p: "Go to HR before you write or act, not after, if any of this is in play: a medical condition or disability, a leave or accommodation request, a safety refusal, a harassment or discrimination allegation, anything involving a protected characteristic, anything union-related, or a pattern that's heading towards termination.",
      },
      {
        p: "And follow your own company's process for anything formal. A verbal warning, a written warning and a performance plan all mean specific things at your company with specific steps attached. This page doesn't know what those are — your policy does, and your policy governs.",
      },

      { h2: "How Frontline Coach helps" },
      {
        p: "Documentation Assistant takes what you actually remember — messy, out of order, half-sentences typed on a phone in the break room — and turns it into a clean factual record with the conclusions stripped out.",
      },
      {
        p: "It organises and it removes editorialising. It doesn't decide anything, it doesn't recommend discipline, and it doesn't know your policy.",
      },
      {
        ul: [
          "Documentation Assistant — rough notes to a factual record, same day, while you still have the words.",
          "Conversation Builder — plan it beforehand so there's something clean to document.",
          "AI Coach — work out what to do about the underlying problem.",
        ],
      },
      {
        p: "Free to start. Built by a Navy veteran and eighteen-year frontline operator who spent years not documenting anything at all.",
        links: [["not documenting anything at all", "/operator"]],
      },

      { h2: "What it won't do" },
      {
        p: "It isn't HR and it isn't a lawyer. It will never tell you to discipline, demote or fire anybody, and it doesn't know your company's policies, your union contract, or your state's employment law. It helps you write down what happened. Everything downstream of that is your decision and your company's process.",
      },

      { h2: "Questions supervisors actually ask" },
      {
        faq: {
          q: "How do I document a verbal warning?",
          a: "Record the date and time, what standard you restated, what you said, what the employee said, anyone present, and what was agreed. Keep it to observable facts and write it the same day. Then follow your company's process — at many companies a verbal warning is a defined step with its own form and requirements, and your policy governs that, not a template.",
        },
      },
      {
        faq: {
          q: "What should I write instead of \"bad attitude\"?",
          a: "Write what made you use that word. \"Rolled his eyes and walked away when asked to redo the mats\" is observable. \"Bad attitude\" is your conclusion about it, and a conclusion can be disputed by anyone who wasn't there. Describe the behaviour and let the reader draw the conclusion.",
        },
      },
      {
        faq: {
          q: "Do I need to document a conversation that went well?",
          a: "A short note is worth it for anything where you restated a standard or agreed on a change, even if the tone was good. That's the note that shows a pattern was addressed early and fairly. It also protects the employee, which is half the point.",
        },
      },
      {
        faq: {
          q: "Should the employee see what I wrote?",
          a: "That depends entirely on your company's policy and the type of documentation, so ask HR rather than deciding yourself. As a discipline though, write every note as if they will read it. It's a good filter for editorialising, and it keeps you honest about what you actually observed.",
        },
      },
      {
        faq: {
          q: "How long should I keep my notes, and where?",
          a: "Follow your company's policy — records retention and where employee records live are governed by it, and personal copies of employee information kept outside company systems can create real problems. If nobody has told you what the policy is, that's a question for HR before you build a filing habit.",
        },
      },
      {
        faq: {
          q: "Can I use AI to write employee documentation?",
          a: "To organise your own observations into clear factual language, yes. What it shouldn't do is invent detail, characterise the person, or decide the outcome. Review every word before it goes anywhere — you're accountable for the record, and it needs to reflect what you actually saw.",
        },
      },
    ],
  },

  // =====================================================
  // SUPPORT — the URL App Store Connect points at
  // =====================================================
  // Added 2 Sep 2026. The App Store support URL was https://frontline-coach.com, which
  // is the app's sign-in screen: somebody looking for help was being asked to log in
  // first. Apple accepts a homepage, but it is a bad answer to "I need help."
  //
  // support@otsowntheshift.com is verified live — a Gmail search for mail addressed to
  // it returns real traffic, while the same search for a made-up address at the same
  // domain returns nothing, so the filter is genuinely matching.
  //
  // NO PRICES ON THIS PAGE, on purpose. It is the one marketing page a store build might
  // reasonably keep, and prices in the binary are a Guideline 3.1.1 problem — see the
  // price guard in scripts/store-clean.mjs.
  {
    slug: "support",
    navLabel: "Support",
    related: ["pricing", "operator", "new-manager-coach"],
    title: "Support — Frontline Coach by Own The Shift",
    description:
      "Get help with Frontline Coach. Email support, account and billing questions, how to delete your account, and how your data is handled.",
    h1: "Support",
    schema: [
      {
        "@type": "ContactPage",
        "@id": `${SITE}/support#page`,
        url: `${SITE}/support`,
        name: "Support — Frontline Coach",
        about: { "@id": APP_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en-US",
      },
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Own The Shift",
        legalName: "OTS Media LLC",
        url: "https://otsowntheshift.com/",
        email: "support@otsowntheshift.com",
      },
    ],
    blocks: [
      { em: "Email support@otsowntheshift.com. A person reads it — there's no ticket system and no bot." },
      {
        p: "Frontline Coach is built and run by one operator, so support is direct. Problem reports get looked at within three business days. Anything about safety or somebody's wellbeing is looked at the same day.",
      },

      { h2: "Before you email" },
      {
        p: "Two things fix most of what comes in. If a reply never arrived or a tool stalled, close the app fully and reopen it — the coaching runs on outside services and a dropped connection looks like a broken app. If the app is asking permission to send your text to those services, that sheet has to be accepted before any tool can answer; you can withdraw it later under Tools, Data and privacy.",
      },

      { h2: "Account and billing" },
      {
        p: "Your subscription, if you have one, is managed through Stripe. The receipt email you got at checkout links to a portal where you can change your card or cancel. Cancelling keeps your access until the end of the period you already paid for.",
      },
      {
        p: "Deleting your account is done inside the app, under Tools, Data and privacy. It removes your account, your conversations, your history and everything the coach remembers about your people. It is immediate and it cannot be undone.",
      },

      { h2: "Your data" },
      {
        p: "What you type is sent to Anthropic to generate a response, and the practice voice is generated by OpenAI. Neither uses your content to train their models. The Privacy Policy names every service, what goes to it, and what it may do with it.",
      },

      { h2: "Reporting a problem with a response" },
      {
        p: "Every coaching response has a Report a problem link underneath it. That is the fastest route for a bad answer, because it comes through with the conversation attached and I can see what actually happened rather than working from a description of it.",
      },

      { h2: "One thing this app is not" },
      {
        p: "It is not legal or HR advice, and it does not know your company's policies. It helps you think through a conversation and say it clearly. Decisions about discipline, pay, leave, or termination belong with your HR team and your own policies, every time.",
      },
      {
        p: "Own The Shift is OTS Media LLC, 11628 Old Ballas Rd, Suite 345, PMB 1228, St. Louis, MO 63141.",
      },
    ],
  },
];
