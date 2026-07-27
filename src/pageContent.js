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
    description:
      "Eighteen years of frontline leadership, learned the wrong way first. A Navy veteran on why newly promoted supervisors get no training, why knowing a standard and teaching one are different skills, and why he built an AI coach for the conversation you're dreading.",
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
];
