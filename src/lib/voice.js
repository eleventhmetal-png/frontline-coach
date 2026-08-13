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
    let restarts = 0;
    let finalText = "";
    let rec = null;
    const startedAt = Date.now();

    function finish() {
      if (done) return;
      done = true;
      onFinal && onFinal(finalText.trim());
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

export function readAloudAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let primed = false;

// iOS refuses to speak unless speechSynthesis has been touched inside a real
// user gesture at least once. The reply arrives after an await, so the gesture
// chain is already broken by then — this has to be called from the tap itself.
export function primeSpeech() {
  if (!readAloudAvailable() || primed) return;
  try {
    const u = new window.SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    primed = true;
  } catch (e) {
    // no-op — worst case read-aloud stays silent until the next tap
  }
}

let spokenUpTo = 0;

export function resetReadAloud() {
  spokenUpTo = 0;
  stopSpeaking();
}

function enqueue(text, rate) {
  if (!text) return;
  try {
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch (e) {
    // no-op
  }
}

// Called on every streaming tick with the FULL text so far. Speaks only what has
// closed a sentence — feeding half-clauses to the synthesizer as they arrive
// makes it stutter and swallow words.
export function speakStream(fullText, opts) {
  if (!readAloudAvailable() || !fullText) return;
  if (fullText.length < spokenUpTo) { spokenUpTo = 0; } // stream restarted
  const pending = fullText.slice(spokenUpTo);
  const m = pending.match(/^[\s\S]*[.!?…]["')\]]?[\s]/);
  if (!m) return;
  spokenUpTo += m[0].length;
  enqueue(m[0].trim(), (opts && opts.rate) || 1);
}

// Called once when the stream finishes, to speak the tail that never got a
// closing punctuation mark.
export function speakRest(fullText, opts) {
  if (!readAloudAvailable() || !fullText) return;
  const rest = fullText.slice(spokenUpTo).trim();
  spokenUpTo = fullText.length;
  enqueue(rest, (opts && opts.rate) || 1);
}

export function stopSpeaking() {
  if (!readAloudAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch (e) {
    // no-op
  }
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
