// =====================================================
// NATIVE DICTATION DRIVER — SFSpeechRecognizer via Capacitor
// =====================================================
// WHY: Apple's WKWebView does not expose webkitSpeechRecognition at all, so the
// web driver in src/lib/voice.js returns unavailable on device and the mic button
// goes dead. This is also the answer to App Store Guideline 4.2 (minimum
// functionality): a webview wrapper that uses no device capability gets rejected
// as "this could just be a website."
//
// Conforms to the driver contract already defined in src/lib/voice.js:
//   { id, available(): bool, start(handlers): { stop() } }
//   handlers: { onPartial(text), onFinal(text), onError(code), onEnd() }
// Error codes must be ones dictationErrorText() knows:
//   denied | timed-out | no-mic | network | unsupported
//
// ─────────────────────────────────────────────────────────────────────────────
// THE PLUGIN CRASHES IF YOU OVERLAP TWO SESSIONS. READ THIS BEFORE EDITING.
// ─────────────────────────────────────────────────────────────────────────────
// Confirmed on device 19 Aug 2026:
//
//   {"errorMessage":"Recognition request was canceled"}
//   Plugin.swift:86: Fatal error: Unexpectedly found nil while unwrapping an Optional
//
// The plugin's start() cancels any existing recognitionTask (its line 59), then
// assigns a fresh recognitionRequest (line 80), then force-unwraps that request
// (line 86). But the cancelled task's error handler runs ASYNCHRONOUSLY and does
// `self.recognitionRequest = nil` (line 118) — so if it lands between 80 and 86 it
// nils the NEW request and the force-unwrap kills the app. Not a Swift crash we
// can catch from JS. A hard process exit.
//
// We cannot patch it — node_modules is wiped on every npm install. The only
// defence is never calling start() while a session is live. Hence:
//   1. IN_FLIGHT below — a module-level guard, because two React event handlers
//      firing on one tap is enough to trigger this.
//   2. stop() then a 250ms settle before every start, so the plugin's task is
//      genuinely nil before we ask for a new one.
//
// That 250ms is not arbitrary. src/lib/voice.js carries the same number with the
// same warning for the web driver: shortening it to 60ms on 18 Aug produced two
// live recognizers fighting over one microphone and broke both the mic and the
// speaker. Same lesson, native edition. Raising it is safe. Lowering it is not.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT DOES NOT CARRY OVER FROM THE WEB DRIVER
// ─────────────────────────────────────────────────────────────────────────────
// The web driver restarts a fresh recognizer at every pause because iOS Safari
// ends the session on its own. SFSpeechRecognizer streams partialResults
// continuously until stop(), so there is no restart loop here. Do not port it.
// What DOES carry over is the wall-clock bound — iOS caps a single recognizer
// around a minute and stops without saying much, so we report "timed-out"
// ourselves rather than appearing to listen while capturing nothing.

import { SpeechRecognition } from "@capacitor-community/speech-recognition";

const MAX_LISTEN_MS = 60 * 1000;
const SETTLE_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// SERIALIZE, DO NOT REFUSE.
//
// An earlier version of this file kept a boolean and rejected any start that
// arrived while a session was live. That looked safe and broke the feature: App.jsx
// has a legitimate resume path (pendingStartRef → open({resumed:true}) 120ms after
// onEnd), and refusing it meant the user tapped the mic and nothing happened, with
// only a console warning to show for it.
//
// So instead of dropping the request we hold a reference to the live session, tear
// it down, and wait for its teardown to actually land before starting the new one.
// Bounded wait, so a session that never reports back cannot deadlock the mic.
let CURRENT = null; // { stop(), done: Promise }

const TEARDOWN_WAIT_MS = 1200;

let _available = false;

export const capacitorDictation = {
  id: "capacitor-speech",

  // Synchronous by contract; the plugin's check is async, so we probe once at
  // init (probeDictation below) and cache it.
  available() {
    return _available;
  },

  start(handlers) {
    const { onPartial, onFinal, onError, onEnd } = handlers || {};
    let stopped = false;
    let finished = false;
    let text = "";
    let listener = null;
    let timer = null;

    // Resolves when this session has fully torn down, so the next start can wait
    // on it rather than racing it.
    let settleDone;
    const done = new Promise((r) => (settleDone = r));
    const previous = CURRENT;
    const self = { stop: () => handle.stop(), done };
    CURRENT = self;

    const finish = (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (listener) {
        try {
          listener.remove();
        } catch (e) {
          /* already gone */
        }
        listener = null;
      }
      // Do not await before onFinal — that would delay the text landing behind a
      // native round trip and the UI would feel like it had hung after the tap.
      // But DO resolve `done` only once the native stop has actually returned, so
      // the next session waits for a real teardown rather than a hopeful one.
      SpeechRecognition.stop()
        .catch(() => {})
        .then(() => settleDone());
      if (CURRENT === self) CURRENT = null;
      if (code) onError && onError(code);
      // onFinal before onEnd, matching the web driver — Practice reads the text
      // on onFinal and clears its listening state on onEnd.
      if (text.trim()) onFinal && onFinal(text.trim());
      onEnd && onEnd();
    };

    (async () => {
      try {
        // Take over from any live session rather than refusing to start. Bounded,
        // so a session that never reports back cannot wedge the mic permanently.
        if (previous) {
          try {
            previous.stop();
          } catch (e) {
            /* already gone */
          }
          await Promise.race([previous.done, sleep(TEARDOWN_WAIT_MS)]);
        }
        if (stopped) return finish(null);

        const perm = await SpeechRecognition.checkPermissions();
        if (perm.speechRecognition !== "granted") {
          const asked = await SpeechRecognition.requestPermissions();
          if (asked.speechRecognition !== "granted") return finish("denied");
        }
        if (stopped) return finish(null);

        // Clear any session the plugin still thinks it has, then let the cancel
        // settle. Belt and braces alongside the patched force-unwrap.
        try {
          await SpeechRecognition.stop();
        } catch (e) {
          /* nothing was running, which is the good case */
        }
        await sleep(SETTLE_MS);
        if (stopped) return finish(null);

        // Remove any listener a previous session leaked before adding ours, or
        // two listeners both push into their own `text` and the transcript
        // appears to duplicate itself.
        try {
          await SpeechRecognition.removeAllListeners();
        } catch (e) {
          /* older plugin versions may not expose this */
        }

        listener = await SpeechRecognition.addListener("partialResults", (data) => {
          if (stopped) return;
          // matches[0] is the full utterance so far, not a delta — assign, never
          // append, or every partial concatenates onto the last.
          const next = data?.matches?.[0];
          if (typeof next === "string" && next) {
            text = next;
            onPartial && onPartial(text);
          }
        });

        // partialResults:true is what makes this feel live. Without it the plugin
        // resolves once at the end and the manager watches a dead text box while
        // they talk, which reads as broken.
        if (stopped) return finish(null);
        await SpeechRecognition.start({
          language: "en-US",
          partialResults: true,
          popup: false,
        });

        timer = setTimeout(() => finish("timed-out"), MAX_LISTEN_MS);
      } catch (err) {
        const msg = String(err?.message || err || "").toLowerCase();
        // "Recognition request was canceled" is what the plugin reports when a
        // session is torn down. That is our own stop, not a fault — surfacing it
        // as an error would flash a warning every time the user finishes talking.
        if (msg.includes("cancel")) return finish(null);
        if (msg.includes("permission") || msg.includes("denied")) return finish("denied");
        if (msg.includes("audio") || msg.includes("busy")) return finish("no-mic");
        if (msg.includes("network")) return finish("network");
        finish("unsupported");
      }
    })();

    const handle = {
      stop() {
        stopped = true;
        finish(null);
      },
    };
    return handle;
  },
};

// Probe availability once at boot. Returns whether the driver is usable so the
// caller can decide whether to register it at all.
//
// Deliberately does NOT request permission. Asking for the mic before the user
// has tapped anything is a bad first run and something reviewers flag — the
// prompt should arrive on the tap, which is what start() does.
export async function probeDictation() {
  try {
    const { available } = await SpeechRecognition.available();
    _available = !!available;
  } catch (e) {
    _available = false;
  }
  return _available;
}
