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
// WHAT CARRIES OVER FROM THE WEB DRIVER AND WHAT DOES NOT:
// The web driver restarts a fresh recognizer at every pause because iOS Safari
// ends the session on its own, and it keeps a hard 250ms gap between recognizers
// because two live recognizers fighting over one mic broke both the mic and the
// speaker (18 Aug). SFSpeechRecognizer through this plugin does NOT have that
// behaviour — partialResults streams continuously until stop() — so there is no
// restart loop here and no gap to protect. Do not port that machinery across.
//
// What DOES carry over is the wall-clock bound. iOS caps a single
// SFSpeechRecognizer session around a minute, and Apple's on-device recognizer
// will stop on its own without telling you much. Bounding it ourselves means the
// UI reports "timed-out" instead of appearing to work while capturing nothing.

import { SpeechRecognition } from "@capacitor-community/speech-recognition";

const MAX_LISTEN_MS = 60 * 1000;

export const capacitorDictation = {
  id: "capacitor-speech",

  // Synchronous by contract, but the plugin's availability check is async. We
  // probe once at init (see requestDictationPermission below) and cache it.
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

    const finish = (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (listener) {
        try {
          listener.remove();
        } catch (e) {
          /* listener already gone */
        }
        listener = null;
      }
      try {
        SpeechRecognition.stop();
      } catch (e) {
        /* already stopped */
      }
      if (code) onError && onError(code);
      // onFinal before onEnd, matching the web driver's order — Practice reads the
      // final text on onFinal and clears its listening state on onEnd.
      if (text.trim()) onFinal && onFinal(text.trim());
      onEnd && onEnd();
    };

    (async () => {
      try {
        const perm = await SpeechRecognition.checkPermissions();
        if (perm.speechRecognition !== "granted") {
          const asked = await SpeechRecognition.requestPermissions();
          if (asked.speechRecognition !== "granted") return finish("denied");
        }

        listener = await SpeechRecognition.addListener("partialResults", (data) => {
          if (stopped) return;
          const next = data?.matches?.[0];
          if (typeof next === "string" && next) {
            text = next;
            onPartial && onPartial(text);
          }
        });

        // partialResults:true is what makes this feel live. Without it the plugin
        // resolves once at the end and the manager watches a dead text box while
        // they talk, which reads as broken.
        await SpeechRecognition.start({
          language: "en-US",
          partialResults: true,
          popup: false,
        });

        timer = setTimeout(() => finish("timed-out"), MAX_LISTEN_MS);
      } catch (err) {
        const msg = String(err?.message || err || "").toLowerCase();
        if (msg.includes("permission") || msg.includes("denied")) return finish("denied");
        if (msg.includes("audio") || msg.includes("busy")) return finish("no-mic");
        if (msg.includes("network")) return finish("network");
        finish("unsupported");
      }
    })();

    return {
      stop() {
        stopped = true;
        finish(null);
      },
    };
  },
};

let _available = false;

// Probe availability once at boot. Returns whether the driver is usable so the
// caller can decide whether to register it at all.
//
// NOTE: this deliberately does NOT request the permission. Asking for the mic
// before the user has tapped anything is both a bad first run and something
// reviewers flag — the prompt should arrive when they tap the mic, which is what
// start() above does.
export async function probeDictation() {
  try {
    const { available } = await SpeechRecognition.available();
    _available = !!available;
  } catch (e) {
    _available = false;
  }
  return _available;
}
