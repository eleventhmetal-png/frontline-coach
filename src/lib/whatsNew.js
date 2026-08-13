// =====================================================
// WHAT'S NEW — one-time release card
// =====================================================
// A dismissible card on Home that announces a release once, then never again.
// Built as a mechanism, not a one-off: to announce the next thing, add an entry
// to RELEASES and bump CURRENT. Nothing else changes.
//
// WHY localStorage AND NOT SUPABASE: this is per-device UI state with zero
// stakes. A DB-backed flag means a migration, an RLS policy, a read on every
// Home mount, and a loading flicker on the most-used screen in the app — all to
// prevent a user who signs in on both their phone and a laptop from seeing one
// card twice. Not worth it. The failure mode of the cheap version is that
// somebody dismisses it twice; the failure mode of the expensive version is a
// slower Home for everyone.
//
// WHY IT FAILS CLOSED: Safari private mode throws on localStorage access. If we
// treated a throw as "not seen," those users would get the card on every single
// page load, which is the worst outcome available. A caught error means the card
// stays hidden. Missing an announcement costs nothing; nagging costs trust.

const KEY = "fc_whatsnew_seen";

// Bump this to announce the next release. The value is what gets written to
// localStorage, so changing it is what makes a new card appear for everyone.
//
// LIVE as of 13 Aug 2026: voice in Practice.
//
// This card is also the NOTICE required by Terms §2. Adding OpenAI as a speech
// processor is a data-use change, and §2 says we tell users rather than let the
// "Last updated" date move quietly. That is why the last bullet names it and the
// footer points at the policy — do not trim those for brevity.
//
// History: "leading-up-live" replaced the original "leading-up-2026-08" because
// that value had been written to localStorage for everyone who saw the card
// during the few hours it shipped ahead of its feature on 11 Aug, Ben included.
// Reusing a burned key hides the real announcement from exactly the people who
// got the broken one.
export const CURRENT = "voice-practice-live";

// Accounts created ON OR AFTER this date never see the card. Someone who signed
// up yesterday doesn't need "what's new" — the whole app is new to them, and an
// announcement about a feature they never lived without reads as noise.
// SET THIS TO THE ACTUAL DEPLOY DATE OF THE FEATURE, not of this file.
const RELEASE_DATE = "2026-08-13";

export const RELEASES = {
  "voice-practice-live": {
    title: "Say it out loud",
    lede: "You can write a good line and still deliver it badly. Practice takes your voice now, and answers in one.",
    bullets: [
      "Tap the mic and say your side the way you'd actually say it",
      "Hear them answer back, guarded or irritated or embarrassed, depending on who you picked",
      "Pick the voice you're up against, and whether it's a man or a woman",
      "New: read-aloud sends the reply text to OpenAI to make the audio. Dictation is handled by your own phone or browser, and we never receive the recording.",
    ],
    footer: "Updated the Privacy Policy to name it. Read it before you use the voice.",
    ctaLabel: "Try it",
    ctaView: "practice",
  },
  "leading-up-live": {
    title: "Now it points up, too",
    lede: "Every tool in here was built for the conversations you have with your team. You can run the ones that go the other way now.",
    bullets: [
      "Tell your boss something went wrong, before they hear it somewhere else",
      "Make a case you might lose, and carry the call if it goes against you",
      "Ask for people, hours, or a path up, priced in something they can act on",
    ],
    footer: "Practice against the kind of boss you're actually dealing with.",
    ctaLabel: "Try it",
    ctaView: "practice",
  },
};

function read() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return CURRENT; // storage blocked: behave as already seen
  }
}

export function markSeen(version = CURRENT) {
  try {
    window.localStorage.setItem(KEY, version);
  } catch {
    /* storage blocked — the card just reappears next load, which is survivable */
  }
}

// True only for an existing user who hasn't dismissed this specific release.
export function shouldShow(session) {
  if (!RELEASES[CURRENT]) return false;
  if (read() === CURRENT) return false;
  const created = session?.user?.created_at;
  if (created && new Date(created) >= new Date(RELEASE_DATE)) {
    markSeen(); // brand-new account: mark it so it never surfaces later either
    return false;
  }
  return true;
}

export function currentRelease() {
  return RELEASES[CURRENT];
}
