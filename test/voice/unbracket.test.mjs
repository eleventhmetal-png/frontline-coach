const { unbracketCommitment: u } = await import(new URL('../../src/lib/followups.js', import.meta.url).href);
const cases = [
  ["Check in after their next [TWO SHIFTS].", "Check in after their next two shifts."],
  ["Follow up on [DATE] with what you saw.",  "Follow up on [DATE] with what you saw."],
  ["Ask again after [THREE DAYS], then decide.", "Ask again after three days, then decide."],
  ["Note the exact [WHAT WAS SAID] in the file.", "Note the exact [WHAT WAS SAID] in the file."],
  ["Recheck at [end of week].", "Recheck at end of week."],
  ["Confirm with [NAME] before Friday.", "Confirm with [NAME] before Friday."],
  ["Check both [TWO SHIFTS] and [DATE].", "Check both two shifts and [DATE]."],
  ["No brackets at all here.", "No brackets at all here."],
  ["", ""],
];
let bad = 0;
for (const [inp, want] of cases) {
  const got = u(inp);
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + JSON.stringify(inp) + (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
console.log(bad ? bad + ' FAILED' : 'all ' + cases.length + ' pass');
process.exitCode = bad ? 1 : 0;
