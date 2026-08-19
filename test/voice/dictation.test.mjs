// WHY THIS EXISTS. On 18 Aug 2026 four wrong fixes shipped to a real device in one
// night, because there was no way to check the dictation state machine without an
// iPhone in hand. The Web Speech API's failure modes are all timing: a session
// restarting, a session being cancelled, two sessions overlapping. All of that is
// testable against a fake recognizer. Run it before touching src/lib/voice.js.
//
//   npm run test:voice
const VOICE = new URL('../../src/lib/voice.js', import.meta.url).href;

// ---- fake iOS SpeechRecognition -------------------------------------------
// Models the behaviour observed in Safari Web Inspector on Ben's iPhone:
// continuous is ignored, the recognizer ends on every pause, and abort()/stop()
// produce an "aborted" error plus audioend before end.
let live = [];            // every recognizer ever constructed
class FakeSR {
  constructor() { this.id = live.length; this.dead = false; live.push(this); }
  start() {
    if (FakeSR.throwOnStart) { FakeSR.throwOnStart--; const e = new Error('InvalidStateError'); throw e; }
    this.started = true;
    setTimeout(() => this.fire('audiostart'), 1);
  }
  stop() { this.closing = 'stop'; setTimeout(() => this.finishAborted(), 1); }
  abort() { this.closing = 'abort'; setTimeout(() => this.finishAborted(), 1); }
  finishAborted() {
    if (this.dead) return;
    this.dead = true;
    this.fire('audioend');
    this.onerror && this.onerror({ error: 'aborted' });
    this.onend && this.onend();
  }
  // helper: deliver a final phrase then end the segment, the way iOS does
  say(text, { final = true } = {}) {
    if (this.dead) return;
    this.onresult && this.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript: text }], { isFinal: final, length: 1 })],
    });
  }
  endSegment() { if (this.dead) return; this.dead = true; this.onend && this.onend(); }
  errorWith(code) { if (this.dead) return; this.onerror && this.onerror({ error: code }); }
  fire(n) { const h = this['on' + n]; if (h) h({}); }
}
FakeSR.throwOnStart = 0;
globalThis.window = { SpeechRecognition: FakeSR };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const { startDictation } = await import(VOICE);

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  :: ' + extra : '')); }
}
function harness() {
  const log = { partial: [], final: [], err: [], ended: 0 };
  const h = startDictation({
    onPartial: t => log.partial.push(t),
    onFinal: t => { log.final.push(t); },
    onError: c => log.err.push(c),
    onEnd: () => log.ended++,
  });
  return { h, log };
}
const cur = () => live[live.length - 1];

// ---- 1. a normal spoken turn ---------------------------------------------
console.log('\n1. normal dictation, two segments with a pause between');
live = [];
{
  const { h, log } = harness();
  await sleep(5);
  cur().say('i wanted to talk about your hours');
  cur().endSegment();
  await sleep(400);                      // restart gap is 250ms
  ok('restarted after the segment ended', live.length === 2, 'recognizers=' + live.length);
  cur().say('because this is the third time');
  cur().endSegment();
  await sleep(400);
  h.stop();
  await sleep(500);
  ok('onFinal carries both segments', /hours/.test(log.final[0] || '') && /third time/.test(log.final[0] || ''), JSON.stringify(log.final));
  ok('onEnd fired exactly once', log.ended === 1, 'ended=' + log.ended);
  ok('no error surfaced', log.err.length === 0, JSON.stringify(log.err));
  console.log('     final text: ' + JSON.stringify(log.final[0]));
}

// ---- 2. cancel must throw the transcript away ----------------------------
console.log('\n2. cancel() mid-sentence (this is what send() does)');
live = [];
{
  const { h, log } = harness();
  await sleep(5);
  cur().say('half a sentence');
  h.cancel();
  await sleep(500);
  ok('no onFinal after cancel', log.final.length === 0, JSON.stringify(log.final));
  ok('onEnd still fired', log.ended === 1, 'ended=' + log.ended);
  ok('the swallowed abort did not surface', log.err.length === 0, JSON.stringify(log.err));
}

// ---- 3. aborted is swallowed and does NOT kill the session ---------------
console.log('\n3. a spurious "aborted" from the platform');
live = [];
{
  const { h, log } = harness();
  await sleep(5);
  cur().errorWith('aborted');
  cur().endSegment();
  await sleep(400);
  ok('session survived and restarted', live.length === 2, 'recognizers=' + live.length);
  ok('nothing shown to the user', log.err.length === 0, JSON.stringify(log.err));
  h.cancel(); await sleep(300);
}

// ---- 4. audio-capture is fatal and surfaces --------------------------------
console.log('\n4. audio-capture (the "mic not found" path)');
live = [];
{
  const { h, log } = harness();
  await sleep(5);
  cur().errorWith('audio-capture');
  cur().endSegment();
  await sleep(900);   // the self-heal waits 600ms before re-booting
  // Current design: the FIRST audio-capture is retried silently after handing the
  // audio session back. Only a second one is reported.
  ok('first audio-capture is retried, not reported', log.err.length === 0, JSON.stringify(log.err));
  ok('it did retry', live.length === 2, 'recognizers=' + live.length);
  await sleep(50);
  if (cur()) { cur().errorWith('audio-capture'); cur().endSegment(); }
  await sleep(500);
  ok('a second audio-capture is reported as no-mic', log.err.includes('no-mic'), JSON.stringify(log.err));
}

// ---- 5. THE REGRESSION: does a throwing start() spawn duplicates? ---------
console.log('\n5. start() throws InvalidStateError (my 60ms-gap regression)');
live = [];
{
  FakeSR.throwOnStart = 1;
  const { h, log } = harness();
  await sleep(600);
  ok('no orphaned second recognizer left running',
     live.filter(r => r.started && !r.dead).length <= 1,
     'alive=' + live.filter(r => r.started && !r.dead).length);
  ok('failure was reported', log.err.length > 0, JSON.stringify(log.err));
  FakeSR.throwOnStart = 0;
}

// ---- 6. the restart ceiling ----------------------------------------------
console.log('\n6. how many pauses before the mic dies silently');
live = [];
{
  const { h, log } = harness();
  await sleep(5);
  let segments = 0;
  for (let i = 0; i < 40; i++) {
    if (!cur() || cur().dead) break;
    cur().say('word ' + i);
    cur().endSegment();
    segments++;
    await sleep(300);
    if (log.ended) break;
  }
  console.log('     segments survived: ' + segments + ', recognizers built: ' + live.length);
  ok('a 30-pause turn does not end silently', log.ended === 0 || log.err.length > 0,
     'ended=' + log.ended + ' errs=' + JSON.stringify(log.err) + ' segments=' + segments);
  ok('if it did end, the user was told', log.ended === 0 || log.err.includes('timed-out'),
     JSON.stringify(log.err));
  h.cancel(); await sleep(300);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
