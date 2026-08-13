// =====================================================
// VOICE — dictation (speech to text) and read-aloud (text to speech)
// =====================================================
// WHY THIS FILE EXISTS AS A SEAM, not as calls inlined in the component:
// today dictation runs on the browser's Web Speech API. When the app ships as a
// Capacitor build, that API is GONE — Apple's WKWebView does not expose
// webkitSpeechRecognition at all, so the native build must go through
// SFSpeechRecognizer (@capacitor-community/speech-recognition). Native dictation
// is also the specific thing that answers App Store Guideline 4.2: a webview
// wrapper with no real device capability gets rejected as "could be a browser
// tab." Registering a driver here means Practice never has to change.
//
// To add the native driver later, at app boot:
//   import { registerDictationDriver } from "./lib/voice";
//   registerDictationDriver(capacitorDictationDriver);
// A driver is: { id, available(): bool, start(handlers): { stop() } }
// Handlers: { onPartial(text), onFinal(text), onError(code), onEnd() }

import { supabase } from "./supabaseClient";

// ---------- dictation ----------

function getSR() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// iOS ignores `continuous = true` and ends the session on its own after a pause,
// so a single recognizer gives you one short burst and quits. We restart a fresh
// recognizer on every end and accumulate the finals ourselves. Bounded twice —
// by count and by wall clock — because a recognizer that ends instantly (no mic
// permission edge cases, backgrounded tab) would otherwise spin forever.
const MAX_RESTARTS = 30;
const MAX_LISTEN_MS = 3 * 60 * 1000;

const webSpeechDictation = {
  id: "web-speech",
  available() {
    return !!getSR();
  },
  start({ onPartial, onFinal, onError, onEnd } = {}) {
    const SR = getSR();
    if (!SR) {
      onError && onError("unsupported");
      onEnd && onEnd();
      return { stop() {} };
    }

    let stopped = false;   // user asked to stop, or a fatal error landed
    let done = false;      // finish() already ran
    // CANCEL vs STOP. stop() means "I'm finished talking, keep what I said."
    // cancel() means "throw away this dictation entirely" — used when the turn
    // has already been sent. Without it, stop()'s onFinal landed AFTER the send
    // cleared the draft and put the spoken text right back in the box, so the
    // next dictation appended to the line you just sent.
    let suppressed = false;
    let restarts = 0;
    let finalText = "";
    let rec = null;
    const startedAt = Date.now();

    function finish() {
      if (done) return;
      done = true;
      if (!suppressed) onFinal && onFinal(finalText.trim());
      onEnd && onEnd();
    }

    function join(a, b) {
      if (!a) return b;
      if (!b) return a;
      return /\s$/.test(a) ? a + b : a + " " + b;
    }

    function boot() {
      try {
        rec = new SR();
      } catch (e) {
        onError && onError("start-failed");
        finish();
        return;
      }
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        if (suppressed) return;
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const t = (r[0] && r[0].transcript ? r[0].transcript : "").trim();
          if (!t) continue;
          if (r.isFinal) finalText = join(finalText, t);
          else interim = join(interim, t);
        }
        onPartial && onPartial(join(finalText, interim));
      };

      rec.onerror = (e) => {
        const code = e && e.error ? e.error : "unknown";
        // no-speech and aborted are normal punctuation in a long dictation —
        // surfacing them would flash an error every time the manager pauses to
        // think, which is exactly when they're doing the hard part.
        if (code === "not-allowed" || code === "service-not-allowed") {
          stopped = true;
          onError && onError("denied");
        } else if (code === "audio-capture") {
          stopped = true;
          onError && onError("no-mic");
        } else if (code === "network") {
          stopped = true;
          onError && onError("network");
        } else if (code !== "no-speech" && code !== "aborted") {
          onError && onError(code);
        }
      };

      rec.onend = () => {
        if (stopped || restarts >= MAX_RESTARTS || Date.now() - startedAt > MAX_LISTEN_MS) {
          finish();
          return;
        }
        restarts++;
        // Small gap before restarting: back-to-back start() calls on iOS throw
        // InvalidStateError and kill the whole session.
        setTimeout(() => {
          if (stopped || done) { finish(); return; }
          boot();
        }, 250);
      };

      try {
        rec.start();
      } catch (e) {
        onError && onError("start-failed");
        finish();
      }
    }

    boot();

    return {
      stop() {
        stopped = true;
        try {
          if (rec) rec.stop();
        } catch (e) {
          // stop() on an already-ended recognizer throws; onend won't fire, so
          // close it out by hand or the UI stays stuck in "listening".
        }
        // Belt and braces: if onend never arrives, finish anyway.
        setTimeout(finish, 400);
      },
      cancel() {
        suppressed = true;
        stopped = true;
        try {
          if (rec) rec.abort ? rec.abort() : rec.stop();
        } catch (e) {
          // same as stop()
        }
        finish();   // clear the UI now, don't wait on onend
      },
    };
  },
};

let dictationDriver = webSpeechDictation;

export function registerDictationDriver(driver) {
  if (driver && typeof driver.start === "function") dictationDriver = driver;
}

export function dictationDriverId() {
  return dictationDriver.id;
}

export function dictationAvailable() {
  try {
    return !!dictationDriver.available && dictationDriver.available();
  } catch (e) {
    return false;
  }
}

export function startDictation(handlers) {
  return dictationDriver.start(handlers || {});
}

export function dictationErrorText(code) {
  switch (code) {
    case "denied":
      return "Microphone access is off. Turn it on in Settings, then tap the mic again.";
    case "no-mic":
      return "No microphone found.";
    case "network":
      return "Dictation needs a connection. Type it instead.";
    case "unsupported":
      return "This browser can't dictate. Type it instead.";
    default:
      return "Dictation dropped out. Tap the mic to pick it back up.";
  }
}

// ---------- read-aloud ----------
// The counterpart's line spoken out loud is the half of voice that changes the
// exercise most: reading a defensive reply and HEARING one are different reps.
//
// TWO DRIVERS, same seam idea as dictation.
//
//   openai-tts  — a real voice. One request per completed turn through our own
//                 /api/tts function so the key stays server-side. ~a cent a rep.
//   browser     — window.speechSynthesis. Free, instant, and on macOS/iOS the
//                 only usable en-US voice is Samantha, which sounds like a GPS
//                 unit. Kept ONLY as the fallback: no key, no network, no
//                 problem — the conversation never stops for want of audio.
//
// The API driver is tried first and demotes itself permanently for the session
// the moment the endpoint says it isn't configured (501), so an app with no
// OPENAI_API_KEY behaves exactly like it did before this existed.

export function readAloudAvailable() {
  // True if EITHER path can talk. The API driver needs no capability check —
  // it either answers or we fall back — so this reduces to the browser check
  // plus "we can make fetch calls", which is always.
  return typeof window !== "undefined";
}

function browserSpeechAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// ---------- voice selection (browser fallback only) ----------
// The browser's DEFAULT voice is whatever the OS hands over, and on macOS that
// list also contains novelty voices (Bells, Zarvox, Trinoids) that would be
// catastrophic in the mouth of a defensive employee. Pick deliberately and
// never touch a novelty.

const VOICE_DENY = /bells|bubbles|boing|bad news|good news|jester|organ|cellos|trinoids|whisper|zarvox|wobble|superstar|junior|ralph|kathy|fred|albert|deranged|hysterical|princess|bahh|grandma|grandpa|rocko|shelley|sandy|eddy|flo|reed|rishi/i;

const VOICE_PREFER = [
  /siri/i, /premium/i, /enhanced/i,
  /\bava\b/i, /samantha/i, /\ballison\b/i, /\bsusan\b/i,
  /\bnicky\b/i, /\bjoelle\b/i, /\bnathan\b/i, /\btom\b/i, /^alex$/i,
];

let cachedVoice = null;

function allVoices() {
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch (e) {
    return [];
  }
}

export function pickVoice() {
  if (cachedVoice) return cachedVoice;
  if (!browserSpeechAvailable()) return null;
  const usable = allVoices().filter(function (x) {
    return /^en/i.test(x.lang || "") && !VOICE_DENY.test(x.name || "");
  });
  if (!usable.length) return null;
  const us = usable.filter(function (x) { return /en[-_]US/i.test(x.lang || ""); });
  const pool = us.length ? us : usable;
  for (var i = 0; i < VOICE_PREFER.length; i++) {
    for (var j = 0; j < pool.length; j++) {
      if (VOICE_PREFER[i].test(pool[j].name || "")) { cachedVoice = pool[j]; return cachedVoice; }
    }
  }
  var local = null;
  for (var k = 0; k < pool.length; k++) {
    if (pool[k].localService) { local = pool[k]; break; }
  }
  cachedVoice = local || pool[0];
  return cachedVoice;
}

// getVoices() returns an EMPTY array on the first call in both Safari and
// Chrome — the list populates asynchronously.
export function warmVoices() {
  if (!browserSpeechAvailable()) return;
  pickVoice();
  try {
    window.speechSynthesis.onvoiceschanged = function () { cachedVoice = null; pickVoice(); };
  } catch (e) { /* no-op */ }
}

export function listVoices() {
  return allVoices().map(function (x) {
    return x.name + " | " + x.lang + (x.localService ? " | local" : " | remote");
  });
}

// ---------- the character being voiced ----------
// Set once when a roleplay starts so the counterpart sounds like the SAME
// person turn to turn, the way lockedStance keeps them behaving like the same
// person. Re-picked on New so the same scenario plays differently twice.

let character = { voice: "ash", instructions: null };

export function setSpeechCharacter(next) {
  character = {
    voice: (next && next.voice) || character.voice,
    instructions: next && "instructions" in next ? next.instructions : character.instructions,
  };
}

// ---------- shared audio element (iOS unlock) ----------
// iOS is STRICTER about HTMLAudioElement than about speechSynthesis: a clip can
// only be played programmatically if this element has already played once
// inside a real user gesture. So there is exactly one element, unlocked on the
// mic tap / speaker toggle, and reused for every reply forever after. Creating
// a fresh Audio() per turn would be locked out on every turn.

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

let audioEl = null;
let audioUrl = null;
let primed = false;

function ensureAudio() {
  if (audioEl) return audioEl;
  if (typeof window === "undefined" || typeof window.Audio === "undefined") return null;
  audioEl = new window.Audio();
  audioEl.preload = "auto";
  // Without playsInline, iOS Safari can hand playback to the fullscreen player.
  audioEl.playsInline = true;
  try { audioEl.setAttribute("playsinline", "true"); } catch (e) { /* no-op */ }
  return audioEl;
}

function releaseUrl() {
  if (!audioUrl) return;
  try { URL.revokeObjectURL(audioUrl); } catch (e) { /* no-op */ }
  audioUrl = null;
}

// Must be called from INSIDE a user gesture. Unlocks both paths at once.
export function primeSpeech() {
  if (primed) return;
  primed = true;
  if (browserSpeechAvailable()) {
    try {
      const u = new window.SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch (e) { /* no-op */ }
  }
  const el = ensureAudio();
  if (el) {
    try {
      el.src = SILENT_WAV;
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) { /* no-op */ }
  }
}

// ---------- browser driver ----------

let spokenUpTo = 0;

function browserEnqueue(text, rate) {
  if (!text || !browserSpeechAvailable()) return;
  try {
    const u = new window.SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-US"; }
    u.rate = (rate || 1) * 0.96;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch (e) { /* no-op */ }
}

const browserSpeech = {
  id: "browser",
  begin() {
    spokenUpTo = 0;
    this.stop();
  },
  // Speaks only what has closed a sentence. Feeding half-clauses to the
  // synthesizer makes it stutter and swallow words.
  onStream(fullText) {
    if (!fullText || !browserSpeechAvailable()) return;
    if (fullText.length < spokenUpTo) spokenUpTo = 0;
    const pending = fullText.slice(spokenUpTo);
    const m = pending.match(/^[\s\S]*[.!?…]["')\]]?[\s]/);
    if (!m) return;
    spokenUpTo += m[0].length;
    browserEnqueue(m[0].trim(), 1);
  },
  onEnd(fullText) {
    if (!fullText || !browserSpeechAvailable()) return;
    const rest = fullText.slice(spokenUpTo).trim();
    spokenUpTo = fullText.length;
    browserEnqueue(rest, 1);
  },
  // Speak a whole line from scratch. Used when the API driver fails mid-turn
  // and the browser has to cover for it.
  speakWhole(text) {
    spokenUpTo = 0;
    browserEnqueue(String(text || "").trim(), 1);
  },
  stop() {
    if (!browserSpeechAvailable()) return;
    try { window.speechSynthesis.cancel(); } catch (e) { /* no-op */ }
  },
};

// ---------- API driver ----------

let ttsUnavailable = false;   // set permanently on 501 (no key configured)
let turnToken = 0;            // guards against a late response for an abandoned turn

async function authHeader() {
  const h = { "Content-Type": "application/json" };
  try {
    const { data } = (await supabase?.auth?.getSession?.()) ?? { data: null };
    const token = data?.session?.access_token;
    if (token) h.Authorization = "Bearer " + token;
  } catch (e) { /* the function will 401 and we'll fall back */ }
  return h;
}

const apiSpeech = {
  id: "openai-tts",
  begin() {
    turnToken++;
    this.stop();
    spokenUpTo = 0;
  },
  // Deliberately does nothing per streaming tick. One request per turn keeps
  // the cost and the request count predictable, and a single clip of the whole
  // line sounds better than four clips stitched together.
  onStream() {},
  async onEnd(fullText) {
    const text = String(fullText || "").trim();
    if (!text) return;
    const mine = turnToken;
    const el = ensureAudio();
    if (!el) { browserSpeech.speakWhole(text); return; }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({
          text,
          voice: character.voice,
          instructions: character.instructions || undefined,
        }),
      });
      if (mine !== turnToken) return;   // New / next turn happened while we waited
      if (res.status === 501) {
        // No key on the server. Stop asking for the rest of the session.
        ttsUnavailable = true;
        browserSpeech.speakWhole(text);
        return;
      }
      if (!res.ok) { browserSpeech.speakWhole(text); return; }
      const blob = await res.blob();
      if (mine !== turnToken) return;
      releaseUrl();
      audioUrl = URL.createObjectURL(blob);
      el.src = audioUrl;
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          // Autoplay refused (never primed inside a gesture). Samantha covers it.
          browserSpeech.speakWhole(text);
        });
      }
    } catch (e) {
      if (mine !== turnToken) return;
      browserSpeech.speakWhole(text);
    }
  },
  stop() {
    turnToken++;
    if (audioEl) {
      try { audioEl.pause(); } catch (e) { /* no-op */ }
      try { audioEl.currentTime = 0; } catch (e) { /* no-op */ }
    }
    releaseUrl();
    browserSpeech.stop();   // whatever was covering for us must stop too
  },
};

let speechDriverOverride = null;

export function registerSpeechDriver(driver) {
  if (driver && typeof driver.onEnd === "function") speechDriverOverride = driver;
}

function activeSpeech() {
  if (speechDriverOverride) return speechDriverOverride;
  return ttsUnavailable ? browserSpeech : apiSpeech;
}

export function speechDriverId() {
  return activeSpeech().id;
}

// ---------- public read-aloud API ----------
// Names kept stable so callers don't care which driver is live.

export function resetReadAloud() {
  activeSpeech().begin();
}

export function speakStream(fullText) {
  activeSpeech().onStream(fullText);
}

export function speakRest(fullText) {
  activeSpeech().onEnd(fullText);
}

export function stopSpeaking() {
  // Stop BOTH: the API driver may have handed this turn to the browser.
  apiSpeech.stop();
  browserSpeech.stop();
}

// ---------- read-aloud preference ----------
// Three states on purpose: "1" on, "0" explicitly off, null never chosen.
// Never-chosen is what lets the first dictation turn it on automatically — a
// manager who just spoke into the mic is somewhere they can talk, which is the
// only real signal we have that a voice coming out of the phone is welcome.

const RA_KEY = "fc_read_aloud";

export function readAloudPref() {
  try {
    const v = localStorage.getItem(RA_KEY);
    return v === null ? null : v === "1";
  } catch (e) {
    return null;
  }
}

export function setReadAloudPref(on) {
  try {
    localStorage.setItem(RA_KEY, on ? "1" : "0");
  } catch (e) {
    // no-op
  }
}
