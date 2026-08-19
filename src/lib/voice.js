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
import { requireAiConsent } from "./aiConsent";

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
// 30 was far too low and it failed SILENTLY. iOS ends the recognizer at every
// pause, so one segment is one breath — a manager working through a hard
// conversation pauses constantly, and a two-minute spoken turn burns 30 segments
// without trying. Past the cap the mic just stopped, no error, mid-sentence.
// The wall clock is the real bound; this counter only exists to stop a recognizer
// that ends instantly from spinning forever, and 120 of those burn ~8 seconds
// before giving up.
const MAX_RESTARTS = 120;
const MAX_LISTEN_MS = 3 * 60 * 1000;
// THE DEAF WINDOW. Every restart is time the mic is not recording, and the words
// spoken into it are gone. 250ms of deliberate delay plus iOS's own start-up
// latency meant the first word after any pause could vanish — the "spotty"
// dictation. Now we restart as fast as iOS will allow and treat the
// InvalidStateError from restarting too fast as the expected case, backing off
// only when it actually throws.
const RESTART_GAP_MS = 60;
const RESTART_LADDER = [80, 180, 350, 700];

// PUNCTUATION FROM PAUSES. The Web Speech API returns no punctuation at all, so a
// dictated turn arrives as one unbroken wall of words — ugly on screen and flat
// when read back. But we DO have real acoustic information for free: the
// recognizer ends a segment when you stop talking, so the gap between one segment
// ending and speech resuming in the next IS a pause. A long gap is a sentence
// boundary. Short gaps are the recognizer timing out mid-thought, which is not.
//
// Threshold has to clear our own restart delay plus recognition latency. That
// delay used to be 250ms and is now 60ms, so a measured gap is closer to the
// true silence than it was and 900ms now means a genuine between-sentence beat
// rather than a breath plus our own overhead.
const SENTENCE_PAUSE_MS = 900;

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
    let segmentEndedAt = 0;   // when the previous segment stopped hearing speech
    let pendingBreak = false; // the gap before this segment was long enough to punctuate
    const startedAt = Date.now();

    function finish() {
      if (done) return;
      done = true;
      if (!suppressed) {
        // Close the last sentence. A dictated turn that ends bare reads as cut off.
        let out = finalText.trim();
        if (out && !/[.!?]$/.test(out)) out += ".";
        onFinal && onFinal(out);
      }
      onEnd && onEnd();
    }

    function cap(s) {
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }
    function join(a, b) {
      if (!a) return cap(b);
      if (!b) return a;
      return /\s$/.test(a) ? a + b : a + " " + b;
    }
    // Same as join, but the gap was long enough to be a full stop.
    function joinSentence(a, b) {
      if (!a) return cap(b);
      if (!b) return a;
      const left = /[.!?,;:]$/.test(a) ? a : a + ".";
      return left + " " + cap(b);
    }

    function boot(attempt) {
      const tries = attempt || 0;
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
        // First words of a new segment: decide now whether the gap we just sat
        // through was a sentence break, and spend that decision once.
        if (segmentEndedAt) {
          pendingBreak = Date.now() - segmentEndedAt > SENTENCE_PAUSE_MS;
          segmentEndedAt = 0;
        }
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const t = (r[0] && r[0].transcript ? r[0].transcript : "").trim();
          if (!t) continue;
          if (r.isFinal) {
            finalText = pendingBreak ? joinSentence(finalText, t) : join(finalText, t);
            pendingBreak = false;
          } else {
            interim = join(interim, t);
          }
        }
        const shown = pendingBreak ? joinSentence(finalText, interim) : join(finalText, interim);
        onPartial && onPartial(shown);
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
        segmentEndedAt = Date.now();   // start timing the gap
        if (stopped || restarts >= MAX_RESTARTS || Date.now() - startedAt > MAX_LISTEN_MS) {
          finish();
          return;
        }
        restarts++;
        // Back-to-back start() calls on iOS throw InvalidStateError, so there is
        // still a gap — just the smallest one that usually works, with a ladder
        // below to cover the times it doesn't.
        setTimeout(() => {
          if (stopped || done) { finish(); return; }
          boot(0);
        }, RESTART_GAP_MS);
      };

      try {
        rec.start();
      } catch (e) {
        // Almost always InvalidStateError: the previous recognizer has not
        // released the mic yet. That is a "wait and try again", not a failure —
        // treating it as fatal is what ended dictation mid-turn.
        const wait = RESTART_LADDER[tries];
        if (wait === undefined) {
          onError && onError("start-failed");
          finish();
          return;
        }
        setTimeout(() => {
          if (stopped || done) { finish(); return; }
          boot(tries + 1);
        }, wait);
      }
    }

    boot(0);

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
      // Throw away what has been recognized WITHOUT ending the session. Used when
      // the mic was deliberately left open through the counterpart's reply: iOS
      // happily transcribes our own synthesized voice, and that text must not
      // become the manager's answer.
      clear() {
        finalText = "";
        pendingBreak = false;
        segmentEndedAt = 0;
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

// SENTENCE PIPELINING. The first version fired ONE request after the whole reply
// finished, which meant the manager watched the text land and then sat in silence
// for two or three more seconds before hearing anything. Now each completed
// sentence is sent as soon as it exists and the clips play back to back, so the
// voice starts while the model is still writing. Billing is per character, so N
// clips cost the same as one — the only real cost is more requests.
//
// Two guards keep it from getting silly: nothing is sent until there are at least
// TTS_MIN_CHUNK characters pending (a request for "Yeah." is a waste and sounds
// clipped), and a turn is capped at TTS_MAX_CHUNKS.
const TTS_MIN_CHUNK = 60;
const TTS_MAX_CHUNKS = 8;

let ttsUpTo = 0;         // characters of the reply already sent for synthesis
let ttsQueue = [];       // in-flight/ready clips, strictly in speaking order
let ttsPumping = false;  // the player loop is running
let ttsChunks = 0;
let ttsAnyPlayed = false;
let ttsFullText = "";    // kept so a fallback can read the whole line
// HANDS-FREE SUPPORT. The mic must not reopen while the counterpart is still
// talking, or it records our own voice. "Idle" is a stricter thing than "the
// queue is empty": mid-stream the queue drains constantly between sentences.
// It means the turn is CLOSED (speakRest has run) AND nothing is left to play.
let ttsTurnClosed = false;
let idleCbs = [];
let idleDeadline = 0;

function resetTtsTurn() {
  ttsUpTo = 0;
  ttsQueue = [];
  ttsChunks = 0;
  ttsAnyPlayed = false;
  ttsFullText = "";
}

async function fetchClip(text, mine) {
  // Belt and braces on Guideline 5.1.2(i). In practice a reply only exists
  // because a gated Claude call already succeeded, so consent is implied — but
  // "implied by the call chain" is a worse answer than "checked here", and this
  // is the only other place user-derived text leaves the device.
  await requireAiConsent();
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({
      text,
      voice: character.voice,
      instructions: character.instructions || undefined,
    }),
  });
  if (mine !== turnToken) return null;
  if (res.status === 501) {
    // No key on the server. Stop asking for the rest of the session.
    ttsUnavailable = true;
    throw new Error("tts-unconfigured");
  }
  if (!res.ok) throw new Error("tts-" + res.status);
  return await res.blob();
}

// Resolves when the clip has finished, however it finishes. It must NEVER reject
// and never hang, because the whole queue is waiting behind it.
function playBlob(el, blob) {
  return new Promise(function (resolve) {
    let settled = false;
    function done() {
      if (settled) return;
      settled = true;
      el.removeEventListener("ended", done);
      el.removeEventListener("error", done);
      resolve();
    }
    el.addEventListener("ended", done);
    el.addEventListener("error", done);
    try {
      releaseUrl();
      audioUrl = URL.createObjectURL(blob);
      el.src = audioUrl;
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(done);
    } catch (e) {
      done();
    }
    // A stalled element must not deadlock the rest of the turn.
    setTimeout(done, 30000);
  });
}

async function pump(el, mine) {
  if (ttsPumping) return;
  ttsPumping = true;
  try {
    while (ttsQueue.length) {
      if (mine !== turnToken) return;
      let blob = null;
      let failed = false;
      try {
        blob = await ttsQueue[0];
      } catch (e) {
        failed = true;
      }
      if (mine !== turnToken) return;
      ttsQueue.shift();
      if (failed) {
        // Failed before a single word was heard: hand the whole line to the
        // browser voice so the conversation still has audio. Failed midway:
        // skip the clip. A one-sentence gap beats restarting the line.
        if (!ttsAnyPlayed) {
          ttsQueue = [];
          browserSpeech.speakWhole(ttsFullText);
          return;
        }
        continue;
      }
      if (!blob) continue;   // superseded turn
      ttsAnyPlayed = true;
      await playBlob(el, blob);
    }
  } finally {
    ttsPumping = false;
    // A clip may have been queued while the loop was draining. Without this
    // re-check the queue can stall with work still in it.
    if (ttsQueue.length && mine === turnToken) pump(el, mine);
    else maybeSpeechIdle();
  }
}

function enqueueClip(el, text, mine) {
  if (!text) return;
  ttsChunks++;
  ttsQueue.push(fetchClip(text, mine));
  pump(el, mine);
}

const apiSpeech = {
  id: "openai-tts",
  begin() {
    turnToken++;
    this.stop();
    spokenUpTo = 0;
    resetTtsTurn();
  },
  // Send every sentence the moment it is complete. This is what removes the
  // dead air between the text landing and the voice starting.
  onStream(fullText) {
    if (!fullText) return;
    ttsFullText = fullText;
    if (ttsUnavailable) { browserSpeech.onStream(fullText); return; }
    const el = ensureAudio();
    if (!el) return;
    if (ttsChunks >= TTS_MAX_CHUNKS) return;
    if (fullText.length < ttsUpTo) ttsUpTo = 0;   // stream restarted
    const pending = fullText.slice(ttsUpTo);
    if (pending.length < TTS_MIN_CHUNK) return;
    // Greedy on purpose: take everything through the LAST sentence end in the
    // pending text, so a fast stream batches instead of firing per clause.
    const m = pending.match(/^[\s\S]*[.!?…]["')\]]?[\s]/);
    if (!m) return;
    ttsUpTo += m[0].length;
    enqueueClip(el, m[0].trim(), turnToken);
  },
  // Flush the tail — the last sentence usually has no trailing whitespace, so
  // onStream never sees it as complete. Short replies come through here whole.
  onEnd(fullText) {
    const text = String(fullText || "");
    ttsFullText = text || ttsFullText;
    if (ttsUnavailable) { browserSpeech.speakWhole(text); return; }
    const el = ensureAudio();
    if (!el) { browserSpeech.speakWhole(text); return; }
    if (text.length < ttsUpTo) ttsUpTo = 0;
    const rest = text.slice(ttsUpTo).trim();
    ttsUpTo = text.length;
    if (rest && ttsChunks < TTS_MAX_CHUNKS) enqueueClip(el, rest, turnToken);
  },
  stop() {
    turnToken++;
    ttsQueue = [];
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

function browserSpeaking() {
  if (!browserSpeechAvailable()) return false;
  try {
    return !!(window.speechSynthesis.speaking || window.speechSynthesis.pending);
  } catch (e) {
    return false;
  }
}

// Fires the one-shot idle subscribers once the voice has genuinely stopped.
// The browser synthesizer gives us no drain event we own, so that path polls.
// The deadline exists so a wedged utterance can't leave a hands-free manager
// staring at a dead mic forever: past it we hand control back anyway.
function maybeSpeechIdle() {
  if (!idleCbs.length || !ttsTurnClosed) return;
  const late = Date.now() > idleDeadline;
  if (!late) {
    if (ttsPumping || ttsQueue.length) return;
    if (browserSpeaking()) { setTimeout(maybeSpeechIdle, 250); return; }
  }
  const cbs = idleCbs;
  idleCbs = [];
  cbs.forEach(function (fn) { try { fn(); } catch (e) { /* no-op */ } });
}

// Subscribe once to "the voice has finished this turn". Calling it when the
// voice is already done fires on the spot, which is the common case for a
// short reply that finished speaking before the caller got here.
export function onSpeechIdle(cb) {
  if (typeof cb !== "function") return;
  idleCbs.push(cb);
  if (!idleDeadline || Date.now() > idleDeadline) idleDeadline = Date.now() + 60000;
  maybeSpeechIdle();
}

// ---------- public read-aloud API ----------
// Names kept stable so callers don't care which driver is live.

export function resetReadAloud() {
  ttsTurnClosed = false;
  idleCbs = [];
  idleDeadline = 0;
  activeSpeech().begin();
}

export function speakStream(fullText) {
  activeSpeech().onStream(fullText);
}

export function speakRest(fullText) {
  activeSpeech().onEnd(fullText);
  // The turn is closed. From here a drained queue means the voice is done, not
  // that it is between sentences.
  ttsTurnClosed = true;
  maybeSpeechIdle();
}

export function stopSpeaking() {
  // Stop BOTH: the API driver may have handed this turn to the browser.
  apiSpeech.stop();
  browserSpeech.stop();
  // Someone cut the voice off deliberately. Dropping the subscribers is the
  // point: a manual stop must not trip an automatic mic reopen.
  idleCbs = [];
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
