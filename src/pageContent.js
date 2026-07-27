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
//   { sig:  "— Ben Ryan" }

export const SITE = "https://frontline-coach.com";
export const ORG_ID = "https://otsowntheshift.com/#org";
export const APP_ID = "https://frontline-coach.com/#app";
export const WEBSITE_ID = "https://frontline-coach.com/#website";
export const PERSON_ID = "https://otsowntheshift.com/#ben-ryan";

export const PAGES = [
  {
    slug: "operator",
    title: "Why I Built Frontline Coach — Ben Ryan, Own The Shift",
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
        name: "Ben Ryan",
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
      { sig: "— Ben Ryan" },
    ],
  },

  {
    slug: "new-manager-coach",
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
        name: "Ben Ryan",
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
];
