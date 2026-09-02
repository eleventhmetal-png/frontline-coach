# Frontline Coach — iOS dictation loop, second opinion wanted

Capacitor 8 app (React + Vite in WKWebView), iPhone 17 Pro Max, physical device.
Speech-to-text via `@capacitor-community/speech-recognition` 7.0.1 (iOS SFSpeechRecognizer).
Text-to-speech is OpenAI audio played through a single HTMLAudioElement.

## SYMPTOM
User taps mic, speaks, hits send. AI replies and is read aloud. Then the mic is
supposed to reopen for the next turn. Instead a second recognition session starts
and is immediately killed. On screen the mic button blinks 1.3s on / 0.7s off,
about ten cycles, no text is ever transcribed, and the input box stays stuck on
"Listening…". Measured off a screen recording, so those timings are exact.

## XCODE CONSOLE (the whole failing cycle)
```
To Native ->  SpeechRecognition available          -> {"available":true}
To Native ->  SpeechRecognition checkPermissions   -> {"speechRecognition":"granted"}
To Native ->  SpeechRecognition stop               -> undefined
To Native ->  SpeechRecognition removeAllListeners -> undefined
To Native ->  SpeechRecognition addListener
To Native ->  SpeechRecognition start              -> undefined
TO JS {"matches":["Hey"]}
TO JS {"matches":["Hey good afternoon"]}
   ... partials build correctly, dictation WORKS ...
TO JS {"matches":["Hey good afternoon come on in let's sit down and we're gonna get going"]}

To Native ->  SpeechRecognition stop               -> undefined     <-- session 1 ends
To Native ->  SpeechRecognition removeListener

To Native ->  SpeechRecognition checkPermissions   -> granted       <-- session 2 begins
To Native ->  SpeechRecognition stop               -> undefined
To Native ->  SpeechRecognition removeAllListeners -> undefined
To Native ->  SpeechRecognition addListener
To Native ->  SpeechRecognition start
WebContent AudioSession::beginInterruption but session is already interrupted!
TO JS {"matches":["...let's sit down we're gonna get going",
                  "...let's sit down and we're gonna get going"]}   <-- TWO alternatives,
                                                                        text from session 1
TO JS {"matches":[""]}
ERROR MESSAGE: {"message":"Recognition request was canceled"}
ERROR MESSAGE: {"message":"Recognition request was canceled"}
```

An earlier run showed the identical pattern. Also present on every send, unexplained:
`Could not parse SSML: TextToSpeech.SSMLParserError.parseError(message: "No single root node found. Found 0 nodes at top-level")`

## WHAT WE HAVE ALREADY RULED OUT
- Not the web SpeechRecognition driver. `available` returns true and the native
  plugin is the one receiving calls.
- Not a permissions problem. `checkPermissions` returns granted every time.
- Not the recognizer itself. Session 1 transcribes perfectly every time.
- Removing an old auto-restart path (a ref that reopened the mic 120ms after a
  session ended) did NOT fix it.

## WHAT WE JUST CHANGED, AND WHY WE ARE NOT SURE IT IS THE WHOLE ANSWER
The native driver's handle exported `stop()` but no `cancel()`. App.jsx calls
`handle.cancel()` on every send inside a bare try/catch, so it threw
`TypeError: cancel is not a function`, the catch swallowed it, and the session was
never torn down — it stayed live in the module-level `CURRENT`. We added a real
`cancel()` with a `suppressed` flag. That plausibly explains the stale duplicate
transcript arriving in session 2, but the AI reply and read-aloud DO happen between
the two sessions, so the audio-session collision may be an independent problem.

## THE QUESTIONS
1. On iOS, the speaker and the mic share one AVAudioSession. We release ours by
   `pause()` + `removeAttribute("src")` + `load()` on the audio element, then wait
   400ms before reopening the mic. Is that actually sufficient to let
   SFSpeechRecognizer take the session, or is there a deterministic signal to wait
   for instead of a fixed delay? `beginInterruption but session is already
   interrupted!` suggests we are still too early.
2. Is `Recognition request was canceled` here the plugin's own teardown of a
   previous request, or the OS refusing because the session is busy? They need
   different fixes and we cannot tell them apart from JS.
3. Is a hands-free loop (mic -> send -> AI speaks -> mic reopens) actually viable
   inside a WKWebView with this plugin, or does the audio element have to be torn
   down and rebuilt every turn? Note our own comment says releasing the element
   costs it user-activation and sets `primed = false`, which we suspect will make
   read-aloud go mute from turn two onward when nothing taps.
4. Any reason `SpeechRecognition.available()` would report true while the session
   is unusable?
5. What produces the SSML parse error? We never call any native TTS plugin.

---

# SOURCE

## src/native/dictation.js  (the native driver, complete)
```js
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
    // CANCEL vs STOP — the web driver has carried this distinction since day one
    // and this driver was missing it entirely, which is the bug behind the 21 Aug
    // 2026 mic loop. stop() means "I'm done talking, keep the words." cancel()
    // means "throw this turn away" and is what send() calls, so the spoken line
    // does not land back in the box after the draft is cleared.
    let suppressed = false;
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
    // If this ever prints previous=true, a session was still live when a new one
    // was requested. That is the shape of every mic bug this feature has had.
    console.info(`[dict] native start previous=${!!previous}`);

    const finish = (code) => {
      if (finished) return;
      finished = true;
      console.info(`[dict] native finish code=${code} suppressed=${suppressed} chars=${text.trim().length}`);
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
      if (!suppressed && text.trim()) onFinal && onFinal(text.trim());
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
      // WITHOUT THIS METHOD, EVERYTHING ABOVE LEAKS.
      // App.jsx calls handleRef.current.cancel() on every send, inside a bare
      // try/catch. On this driver that threw TypeError: cancel is not a function,
      // the catch swallowed it, and the recogniser was never torn down — it stayed
      // live as CURRENT. The next start() then found a `previous` session still
      // holding the audio hardware and tried to take over, which is the second
      // `start` in Ben's device log and the "Recognition request was canceled"
      // that followed it.
      //
      // It also explains the stale duplicate transcript. The abandoned session's
      // finals were still being delivered, which is why the log showed two
      // alternatives arriving in the NEW session's listener:
      //   {"matches":["...let's sit down we're gonna get going",
      //               "...let's sit down and we're gonna get going"]}
      //
      // An empty catch around a call to an optional method is how a missing method
      // survives for weeks. App.jsx now falls back to stop() and logs instead.
      cancel() {
        suppressed = true;
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

```

## src/lib/voice.js — audio session release + hands-free handoff
```js
function releaseAudioSession() {
  const el = audioEl;
  releaseUrl();
  if (el) {
    try { el.pause(); } catch (e) { /* no-op */ }
    try { el.removeAttribute("src"); } catch (e) { /* no-op */ }
    try { el.load(); } catch (e) { /* no-op */ }
  }
  audioEl = null;
  primed = false;
  // speechSynthesis holds the session too when it covered for us this turn.
  try { if (browserSpeechAvailable()) window.speechSynthesis.cancel(); } catch (e) { /* no-op */ }
}

// Called wherever the queue might have just gone empty. Releases only when the
// turn is CLOSED, because mid-reply the queue drains between every sentence.
function maybeReleaseAfterTurn(mine) {
  if (!ttsTurnClosed) return;
  if (mine !== turnToken) return;
  if (ttsPumping || ttsQueue.length) return;
  // Let the final clip's tail flush before pulling the element out from under it.
  setTimeout(function () {
    if (mine !== turnToken || ttsPumping || ttsQueue.length) return;
    if (browserSpeechAvailable()) {
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return;
      } catch (e) { /* no-op */ }
    }
    releaseAudioSession();
    // HANDS-FREE HANDOFF POINT. This exact line is the only moment in the whole
    // voice feature when the reply has finished speaking AND the iOS audio session
    // has actually been handed back. Anything that wants the microphone next has
    // to wait for here — Ben's 21 Aug device log is what happens if it doesn't:
    //     AudioSession::beginInterruption but session is already interrupted!
    //     ERROR: Recognition request was canceled
    // The speaker and the mic share one session. There is no delay you can tune
    // your way past; you wait for the release or you get cancelled.
    if (onTurnSpoken) {
      console.info("[tts] turn spoken, audio session released — handing off to hands-free");
      const fn = onTurnSpoken;
      try { fn(); } catch (e) { /* a listener must never break the audio path */ }
    }
  }, 400);
}

// Set by whoever wants to know the counterpart has stopped talking. One slot, not
// a list: two things racing for the microphone is the bug this feature keeps
// producing, so the API makes it impossible to have two.
let onTurnSpoken = null;
export function setTurnSpokenHandler(fn) { onTurnSpoken = typeof fn === "function" ? fn : null; }


```

## src/App.jsx — useDictation hook (owns mic state, open/toggle/cancel)
```jsx
function useDictation({ value, setValue, onFirstUse }) {
  const [listening, setListening] = useState(false);
  // Live copy, because toggle() runs from a tap handler whose closure may be one
  // render behind the state.
  const listeningRef = useRef(false);
  // When the mic actually opened. A tap that lands within a moment of that is not
  // somebody changing their mind, it is the second half of a double tap.
  const openedAtRef = useRef(0);
  // stop() is not instant: it flags the driver, calls rec.stop(), and waits up to
  // 400ms for onend. Through that window `listening` is still true, so a tap
  // meaning "open it again" lands in the stop branch and is swallowed.
  const stoppingRef = useRef(false);
  // SESSION TOKEN. Every startDictation call gets its own handlers, and a dying
  // session's onEnd used to fire straight into this hook's state with no idea it
  // was stale. Start a new mic before the old recognizer has finished winding down
  // and the old onEnd would set listening false and null out handleRef, orphaning
  // the mic that was actually recording: it stayed on, the button went dark, and
  // nothing could stop it. That is why tapping while the iOS mic pill is still up
  // did not work at all.
  const sessionRef = useRef(0);
  const [err, setErr] = useState("");
  const handleRef = useRef(null);
  const baseRef = useRef("");     // whatever was already in the field before the mic opened
  const valueRef = useRef(value); // so toggle() reads the live value without re-binding
  const usedRef = useRef(false);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);
  // Practice stays mounted behind a display:none wrapper, so leaving the tab does
  // NOT unmount it and would otherwise leave the mic hot.
  useEffect(() => () => { try { handleRef.current && handleRef.current.cancel(); } catch (e) {} }, []);
  const available = dictationAvailable();
  function markUsed() {
    if (usedRef.current) return;
    usedRef.current = true;
    if (onFirstUse) onFirstUse();
  }
  // THE DOUBLE-TAP BUG. Proven on device: one tap opened the mic, a second tap
  // milliseconds later called stop() on it, and the manager then talked into a
  // recognizer that had already aborted. Nothing surfaced, because the driver
  // deliberately swallows the "aborted" code so a normal pause does not flash an
  // error. Two people tap twice: someone who double-taps by habit, and someone
  // whose first tap looked like it did nothing.
  // So the first 700ms of a live mic cannot be tapped shut. Changing your mind
  // that fast is not a real intention; killing the mic you just asked for is not
  // what that tap meant.
  const OPEN_GRACE_MS = 700;
  // VOICE TRACE. Every one of these logs exists because this feature has now cost
  // several nights to two separate bugs that were invisible from the outside: the
  // symptom is always "the mic loops", and the question is always "who asked it
  // to". Xcode console is the only place that can answer that on a real device, so
  // the answer is printed there. `[dict]`/`[tts]` prefixes to filter on.
  function open({ resumed = false, reason = "tap" } = {}) {
    console.info(`[dict] open reason=${reason} listening=${listeningRef.current} stopping=${stoppingRef.current}`);
    if (listeningRef.current) return;
    if (!available) { setErr(dictationErrorText("unsupported")); return; }
    stopSpeaking();   // never dictate over our own voice — the mic hears it
    if (!resumed) primeSpeech();   // must happen inside the tap or iOS stays mute later
    setErr("");
    const cur = valueRef.current || "";
    baseRef.current = cur ? cur.replace(/\s+$/, "") + " " : "";
    // Set synchronously: startDictation can call back before this render commits,
    // and a second tap can arrive before it too.
    const mine = ++sessionRef.current;
    listeningRef.current = true;
    stoppingRef.current = false;
    openedAtRef.current = Date.now();
    setListening(true);
    handleRef.current = startDictation({
      onPartial: (t) => {
        if (mine !== sessionRef.current) return;
        if (t) markUsed();
        setValue(baseRef.current + t);
      },
      onFinal: (t) => {
        if (mine !== sessionRef.current) return;
        if (t) { markUsed(); setValue(baseRef.current + t); }
      },
      onError: (code) => { if (mine === sessionRef.current) setErr(dictationErrorText(code)); },
      onEnd: () => {
        // A superseded session finishing must not touch anything. It is reporting
        // on a mic nobody is using any more.
        if (mine !== sessionRef.current) return;
        listeningRef.current = false;
        stoppingRef.current = false;
        setListening(false);
        handleRef.current = null;
        // NOTHING REOPENS THE MIC HERE. See the note on toggle() below — this
        // block used to queue a restart 120ms after a session ended, and that is
        // the loop Ben caught on device 21 Aug 2026.
      },
    });
  }
  function toggle() {
    // THE MIC ONLY EVER OPENS FROM A TAP, AND ONE TAP OPENS IT ONCE.
    //
    // This used to queue a restart for when the dying session landed. Ben's device
    // log, 21 Aug 2026, is what that produced. Dictation worked perfectly — full
    // partials, "Hey we need to talk about some things that are going on with you
    // and your reactions to feedback" — and then a second `start` fired straight
    // into a still-busy audio session:
    //
    //     AudioSession::beginInterruption but session is already interrupted!
    //     ERROR: Recognition request was canceled
    //
    // iOS gives the speaker and the microphone ONE audio session. Read-aloud was
    // still holding it, so every reopened recognizer was killed on arrival, and the
    // UI sat on "Listening…" forever. On screen that was a 1.3s-on / 0.7s-off blink,
    // ten cycles, not one character transcribed.
    //
    // This is the same speaker-vs-mic wall that killed four earlier attempts at
    // hands-free. It cannot be fixed with a longer delay; the session is genuinely
    // in use. So a tap arriving while the mic is closing is IGNORED. Losing one
    // impatient tap is a papercut. Reopening the mic on its own is the bug.
    if (stoppingRef.current) return;
    if (listeningRef.current) {
      if (Date.now() - openedAtRef.current < OPEN_GRACE_MS) return;
      stoppingRef.current = true;
      try { handleRef.current && handleRef.current.stop(); } catch (e) {}
      return;
    }
    open();
  }
  // cancel() throws the in-flight transcript away. Use it any time the field is
  // about to be cleared or abandoned; stop() would put the words straight back.
  function cancel() {
    if (!listeningRef.current) return;
    stoppingRef.current = false;
    listeningRef.current = false;
    // NEVER swallow this silently again. A bare try/catch here hid a driver that
    // had no cancel() at all for weeks: the call threw, the catch ate it, and the
    // recogniser stayed live and fought the next one for the microphone.
    const h = handleRef.current;
    if (!h) return;
    try {
      if (typeof h.cancel === "function") h.cancel();
      else {
        console.warn(`[dictation] driver "${dictationDriverId()}" has no cancel() — falling back to stop(). The spoken line may reappear in the box after send.`);
        h.stop();
      }
    } catch (e) {
      console.error("[dictation] cancel failed:", e);
    }
  }
  return {
    available, listening, err, toggle, cancel,
    // Programmatic open, for hands-free only. Deliberately NOT the same entry
    // point as toggle(): this one must only ever be called from the turn-spoken
    // handoff in voice.js, never on a timer and never from a tap.
    openHandsFree: () => { if (!listeningRef.current) open({ resumed: true, reason: "hands-free" }); },
    used: () => usedRef.current,
    reset: () => { usedRef.current = false; setErr(""); },
  };
}


```

## src/App.jsx — hands-free wiring in Roleplay
```jsx
loudRef.current = readAloud; }, [readAloud]);

  // ===================================================================
  // HANDS-FREE: tap once, then talk it out like a real conversation
  // ===================================================================
  // Ben's spec, 21 Aug 2026: "I hit the mic, speak, hit send, the mic shuts off,
  // AI speaks and finishes, the mic turns on... rinse repeat until the
  // conversation is over." Which is right — a manager rehearsing a hard
  // conversation should not be tapping a button between every sentence.
  //
  // WHY THIS CAN WORK NOW WHEN IT FAILED FOUR TIMES BEFORE: every earlier attempt
  // was in the PWA, where opening the mic requires a real user gesture and a
  // callback is not one. In the native shell the Capacitor plugin has no gesture
  // rule — the device log proves a programmatic `start` reaches the plugin fine.
  // The only thing that ever killed it was WHEN it fired, not that it fired.
  //
  // So this hangs off the one honest signal: setTurnSpokenHandler runs after the
  // reply has finished speaking AND releaseAudioSession() has handed the iOS audio
  // session back. Not a timer. Not onEnd of the previous dictation. Fire it a beat
  // earlier and you get the cancelled-recogniser loop back.
  //
  // Native only, and only when the reply voice is on — with read-aloud off there
  // is no "AI finished speaking" moment to hand off from, so the mic would reopen
  // instantly and fight the user.
  const handsFree = readAloud && isNative() && dict.available;
  const dictRef = useRef(dict);
  useEffect(() => { dictRef.current = dict; });
  useEffect(() => {
    if (!started || score || !handsFree) { setTurnSpokenHandler(null); return; }
    setTurnSpokenHandler(() => {
      // Re-check at fire time: the turn may have ended while the tail was flushing.
      const d = dictRef.current;
      if (d && d.available) d.openHandsFree();
    });
    return () => setTurnSpokenHandler(null);
  }, [started, score, handsFree]);
  function toggleReadAloud() {
    const next = !readAloud;
    setReadAloud(next);
    setReadAloudPref(next);
    if (!next) stopSpeaking();
    else primeSpeech();
  }
  // Practice is the one tool with a real multi-turn transcript, so it's the
  // one place a synthesized pattern is earned. Show what the nightly job pulled
  // from the last few reps right before th
```

## src/App.jsx — the send path
```jsx
 async function send() {
    // Guarded on `loading` because the textarea's Enter handler calls send()
    // directly and bypassed the send button's disabled state. Two concurrent
    // streams each wrote setHistory from their own captured array, so whichever
    // finished last silently overwrote the other turn.
    if (loading || !draft.trim()) return;
    // Inside the tap. The audio element is released after each reply so the mic
    // can have the session back, which means a fresh one needs priming every turn
    // or read-aloud goes silent for anyone who types instead of dictating.
    primeSpeech();
    // CANCEL, not stop. stop() keeps the transcript and hands it back through
    // onFinal — which lands after setDraft("") below and puts the sent line
    // straight back in the box, so the next dictation appends to it.
    dict.cancel();
    const sent = draft.trim();
    const next = [...history, { role: "user", content: sent }];
    setHistory([...next, { role: "assistant", content: "" }]);
    setDraft(""); setLoading(true); setError(""); scrollDown();
    const sys = buildRpSystem();
    try {
      let spoken = "";
      resetReadAloud();
      await streamChat(sys, next,
        (t) => {
          const clean = cleanTurn(t);
          spoken = clean;
          setHistory([...next, { role: "assistant", content: clean }]);
          // Speak only completed sentences as they land. Feeding half-clauses to
          // the synthesizer makes it stutter and swallow words.
          if (readAloudRef.current) speakStream(clean);
          scrollDown();
        },
        { model: MODEL_FAST, max_tokens: 350, temperature: 0.9 });
      if (readAloudRef.current) speakRest(spoken);
    } catch (e) {
      // Roll the empty assistant placeholder back out of the transcript and give
      // the manager their line back. Left in place it poisoned every subsequent
      // turn: the next send shipped a message with empty content, which the API
      // rejects, so "Try sending again" could never work.
      setHistory(history);
      setDraft(sent);
      setError(errMessage(e, "No reply came back. Try sending again."));
    } finally {
      setLoading(false);
    }
  }
  async function endAndScore() {
    setLoading(true); setError(""); setSessionId(null);
    const up = lockedDirection.current === "up";
    const transcript = history.map((m) => `${m.ro
```
