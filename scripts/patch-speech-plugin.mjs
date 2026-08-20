// =====================================================
// PATCH @capacitor-community/speech-recognition
// =====================================================
// Removes a force-unwrap that hard-crashes the app. Runs as an npm `postinstall`
// hook, so it re-applies itself every time node_modules is rebuilt. Idempotent
// and non-fatal: if the upstream source has changed shape it warns and exits 0
// rather than breaking the install.
//
// THE CRASH (confirmed on device, 19 Aug 2026):
//
//   {"errorMessage":"Recognition request was canceled"}
//   Plugin.swift:86: Fatal error: Unexpectedly found nil while unwrapping an Optional
//
// Plugin.swift line 86 reads:
//
//   self.recognitionTask = self.speechRecognizer?.recognitionTask(
//       with: self.recognitionRequest!, resultHandler: { ... })
//
// recognitionRequest is assigned six lines earlier, so it looks safe. It isn't.
// The plugin nils that same property from THREE async callbacks — its isFinal
// handler (line 111), its error handler (line 118), and stop() via endAudio().
// Any of those can land between the assignment and the force-unwrap, and a
// force-unwrap on nil is a hard process exit that JavaScript cannot catch.
//
// We hit it because dictation naturally starts a session soon after ending one.
// Guarding on the JS side (see src/native/dictation.js — an in-flight lock plus a
// 250ms settle) makes it much rarer but cannot close the window: iOS can end a
// recognition session on its own at any point, including mid-start.
//
// The fix is a two-line change to the plugin: take a local strong reference and
// bail out politely instead of trapping. Behaviour is otherwise identical, and
// "Recognition request was canceled" is already a message the plugin produces and
// our driver already treats as a normal end rather than an error.
//
// Upstream is at 7.0.1 with no 8.x line. If a fixed release appears, delete this
// script and the postinstall hook.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILE =
  "node_modules/@capacitor-community/speech-recognition/ios/Plugin/Plugin.swift";

const BROKEN = `            self.recognitionTask = self.speechRecognizer?.recognitionTask(with: self.recognitionRequest!, resultHandler: { (result, error) in`;

const FIXED = `            // PATCHED by scripts/patch-speech-plugin.mjs — do not revert.
            // The original force-unwrapped self.recognitionRequest here, which is
            // nilled from three async callbacks in this same file and so can be nil
            // by the time this line runs. That was a hard crash, not a catchable
            // error. Bail out instead; the JS driver treats this rejection as a
            // normal end of dictation.
            guard let activeRequest = self.recognitionRequest else {
                call.reject("Recognition request was canceled")
                return
            }
            self.recognitionTask = self.speechRecognizer?.recognitionTask(with: activeRequest, resultHandler: { (result, error) in`;

const MARKER = "PATCHED by scripts/patch-speech-plugin.mjs";

if (!existsSync(FILE)) {
  console.log("patch-speech-plugin: plugin not installed, nothing to do");
  process.exit(0);
}

const src = readFileSync(FILE, "utf8");

if (src.includes(MARKER)) {
  console.log("patch-speech-plugin: already patched");
  process.exit(0);
}

if (!src.includes(BROKEN)) {
  console.warn(
    "patch-speech-plugin: WARNING — the line this patch targets was not found.\n" +
      "  The plugin source has changed. Check whether the force-unwrap of\n" +
      "  recognitionRequest still exists in Plugin.swift. If it does, update\n" +
      "  scripts/patch-speech-plugin.mjs. If upstream fixed it, delete this script\n" +
      "  and the postinstall hook in package.json."
  );
  process.exit(0); // never break an install over this
}

writeFileSync(FILE, src.replace(BROKEN, FIXED));
console.log("patch-speech-plugin: removed the recognitionRequest force-unwrap");
