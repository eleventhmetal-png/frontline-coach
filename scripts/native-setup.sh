#!/usr/bin/env bash
# =====================================================
# ONE-COMMAND NATIVE SETUP
# =====================================================
# Turns the web app into an iOS (and optionally Android) project. Run from the
# project root on the Mac:
#
#   bash scripts/native-setup.sh
#   bash scripts/native-setup.sh --android     # also add Android
#
# Safe to run more than once. Every step checks whether it already happened, so a
# re-run after fixing something does not duplicate anything.
#
# WHY THIS IS A SCRIPT AND NOT A LIST OF INSTRUCTIONS: the source edits in steps 3
# and 4 have to land AFTER npm install, or both builds break on unresolved imports.
# Ordering is the whole point.

set -euo pipefail

ANDROID=0
[[ "${1:-}" == "--android" ]] && ANDROID=1

say()  { printf "\n\033[1;33m==> %s\033[0m\n" "$1"; }
ok()   { printf "    \033[0;32m✓\033[0m %s\n" "$1"; }
skip() { printf "    \033[0;90m·\033[0m %s\n" "$1"; }
die()  { printf "\n\033[1;31mSTOP: %s\033[0m\n\n" "$1" >&2; exit 1; }

# ---------------------------------------------------------------- 0. sanity
say "Checking this machine"

[[ "$(uname)" == "Darwin" ]] || die "This has to run on the Mac. iOS builds cannot be made anywhere else."
ok "macOS"

[[ -f package.json ]] || die "Run this from the project root (the folder with package.json in it)."
grep -q '"name": "frontline-coach"' package.json || die "This does not look like the frontline-coach project."
ok "in the right folder"

command -v node >/dev/null || die "Node is not installed. Install it from https://nodejs.org and run this again."
ok "node $(node -v)"

if ! xcode-select -p >/dev/null 2>&1; then
  die "Xcode is not installed.
  1. Open the App Store, search Xcode, install it. It is about 7GB, so give it time.
  2. Open Xcode once and accept the licence agreement.
  3. Run this script again."
fi
ok "Xcode at $(xcode-select -p)"

if ! command -v pod >/dev/null 2>&1; then
  die "CocoaPods is not installed. Capacitor needs it to build the iOS project.
  Run this, then run this script again:
      brew install cocoapods
  (If you do not have brew: sudo gem install cocoapods)"
fi
ok "cocoapods $(pod --version 2>/dev/null || echo '?')"

if [[ $ANDROID -eq 1 ]] && [[ -z "${ANDROID_HOME:-}" ]] && [[ ! -d "$HOME/Library/Android/sdk" ]]; then
  die "Android Studio does not look installed, but --android was passed.
  Install it from https://developer.android.com/studio, open it once to let it
  download the SDK, then run this again. Or drop --android and do iOS first."
fi

# ------------------------------------------------------------ 1. bundle id
say "Bundle ID"
BUNDLE_ID=$(node -e "console.log(require('./capacitor.config.json').appId)")
printf "    Currently: \033[1m%s\033[0m\n" "$BUNDLE_ID"
cat <<'EOF'
    This is permanent once you submit a build to Apple. If App Store Connect
    already has a different Bundle ID for this app, stop now, fix appId in
    capacitor.config.json, and re-run.
EOF
read -r -p "    Is this Bundle ID correct? [y/N] " reply
[[ "$reply" =~ ^[Yy]$ ]] || die "Fix appId in capacitor.config.json, then run this again."
ok "confirmed"

# ------------------------------------------------------- 2a. lockfile check
# THE "Invalid Version" BUG. fsevents is a macOS-only optional dependency. Run
# npm install on Linux and npm skips it, writing a hollow lockfile entry —
# {"dev":true,"optional":true} with no version, no resolved, no integrity. Bring
# that lockfile back to a Mac and npm tries to install fsevents for real, reads the
# stub, finds no version and dies with "npm error Invalid Version:".
#
# This is the contamination the package-lock.json note in .gitignore is about. The
# lockfile is gitignored precisely so each machine can hold its own, so deleting it
# costs nothing — npm rebuilds it from package.json.
say "Checking the lockfile is not Linux-contaminated"
if [[ -f package-lock.json ]]; then
  BROKEN=$(node -e "
    const l = require('./package-lock.json');
    const bad = Object.entries(l.packages || {})
      .filter(([k, v]) => k && v && typeof v === 'object' && !v.link && v.version === undefined)
      .map(([k]) => k);
    console.log(bad.length);
  ")
  if [[ "$BROKEN" != "0" ]]; then
    printf "    \033[1;31m%s hollow entr%s found\033[0m — this is the Invalid Version bug.\n" \
      "$BROKEN" "$([[ "$BROKEN" == "1" ]] && echo y || echo ies)"
    echo "    Deleting package-lock.json and node_modules so npm can rebuild them"
    echo "    natively. Both are gitignored; nothing is lost."
    rm -f package-lock.json
    rm -rf node_modules
    ok "cleared — the install below will take a couple of minutes longer"
  else
    ok "lockfile is clean"
  fi
else
  skip "no lockfile yet"
fi

# --------------------------------------------------------------- 2. install
say "Installing the native plugins"
if [[ -d node_modules/@capacitor/core ]]; then
  skip "already installed"
else
  npm install @capacitor/core @capacitor/ios @capacitor/app @capacitor/browser \
              @capacitor-community/speech-recognition
  npm install -D @capacitor/cli
  [[ $ANDROID -eq 1 ]] && npm install @capacitor/android
  ok "installed"
fi

# ------------------------------------------------- 3. switch on native code
say "Switching on the native code"
if grep -q "initNative" src/main.jsx; then
  skip "src/main.jsx already calls initNative()"
else
  cp src/main.jsx src/main.jsx.bak
  node - <<'NODE'
const fs = require("fs");
const p = "src/main.jsx";
let s = fs.readFileSync(p, "utf8");
const anchor = 'import "./index.css";';
if (!s.includes(anchor)) { console.error("Could not find the import block in main.jsx"); process.exit(1); }
s = s.replace(anchor, anchor + '\nimport { initNative } from "./native";');
s = s.replace("ReactDOM.createRoot(", "initNative();\n\nReactDOM.createRoot(");
fs.writeFileSync(p, s);
NODE
  ok "src/main.jsx wired up (backup at src/main.jsx.bak)"
fi

# --------------------------------------------------------- 4. supabase pkce
say "Putting Supabase on the PKCE flow (required for Google sign-in on device)"
if grep -q "flowType" src/lib/supabaseClient.js; then
  skip "flowType already set"
else
  cp src/lib/supabaseClient.js src/lib/supabaseClient.js.bak
  node - <<'NODE'
const fs = require("fs");
const p = "src/lib/supabaseClient.js";
let s = fs.readFileSync(p, "utf8");
const anchor = "detectSessionInUrl: true,";
if (!s.includes(anchor)) { console.error("Could not find the auth options block"); process.exit(1); }
s = s.replace(anchor, anchor + '\n        // PKCE is required by exchangeCodeForSession() in src/native/googleAuth.js.\n        // On implicit the deep link returns tokens in the URL fragment instead of a\n        // ?code, the exchange finds nothing, and native sign-in hangs with no error.\n        flowType: "pkce",');
fs.writeFileSync(p, s);
NODE
  ok "flowType: pkce set (backup at src/lib/supabaseClient.js.bak)"
  printf "    \033[1;33mNOTE\033[0m This one affects the website too. Deploy the web app when you\n"
  printf "         next push, so web and app are on the same auth flow.\n"
fi

# ----------------------------------------------------------- 5. build + add
say "Building the store bundle"
npm run build:store
ok "built and passed the beta / API-base checks"

# COCOAPODS, NOT SPM — this is load-bearing.
# Capacitor 8 creates iOS projects with Swift Package Manager by default. But
# @capacitor-community/speech-recognition ships ONLY a .podspec and no
# Package.swift, so an SPM project silently omits it. `cap sync` still says
# "Found 3 Capacitor plugins", the build succeeds, the app runs — and on device
# probeDictation() returns false and dictation is dead. Confirmed on Ben's iPhone
# 19 Aug: "[warn] Speech recognition unavailable on ios — keeping the web driver."
# WKWebView has no webkitSpeechRecognition either, so the fallback is dead too,
# which means no dictation at all and a Guideline 4.2 problem on top.
say "Creating the iOS project (CocoaPods, not SPM — the speech plugin needs it)"
if [[ -d ios/App/CapApp-SPM ]]; then
  printf "    \033[1;31mios/ was built with SPM\033[0m, which cannot link the speech-recognition plugin.\n"
  echo "    It has to be recreated with CocoaPods. Deleting ios/ and rebuilding it."
  echo "    You WILL have to re-pick your Team in Xcode afterwards — signing settings"
  echo "    live inside ios/. That is one dropdown, nothing else is lost."
  read -r -p "    Delete ios/ and recreate with CocoaPods? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || die "Left ios/ alone. Dictation will not work until this is done."
  rm -rf ios
  ok "removed the SPM project"
fi
if [[ -d ios ]]; then
  skip "ios/ already exists"
else
  npx cap add ios --packagemanager CocoaPods
  ok "ios/ created with CocoaPods"
fi

if [[ $ANDROID -eq 1 ]]; then
  say "Creating the Android project"
  if [[ -d android ]]; then skip "android/ already exists"; else npx cap add android; ok "android/ created"; fi
fi

# --------------------------------------------------- 6. iOS permissions etc
say "Adding the iOS permission text and the sign-in URL scheme"
PLIST="ios/App/App/Info.plist"
[[ -f "$PLIST" ]] || die "Expected $PLIST and it is not there. Did 'npx cap add ios' fail above?"
PB=/usr/libexec/PlistBuddy

plist_has() { $PB -c "Print :$1" "$PLIST" >/dev/null 2>&1; }

# Apple rejects vague permission strings under Guideline 5.1.1. These say what the
# feature does and why, which is what the reviewer is looking for.
if plist_has NSMicrophoneUsageDescription; then
  skip "microphone description present"
else
  $PB -c "Add :NSMicrophoneUsageDescription string 'Frontline Coach uses the microphone so you can practise a difficult conversation out loud instead of typing it.'" "$PLIST"
  ok "microphone description added"
fi

if plist_has NSSpeechRecognitionUsageDescription; then
  skip "speech recognition description present"
else
  $PB -c "Add :NSSpeechRecognitionUsageDescription string 'Speech recognition turns what you say during a practice conversation into text so it can be coached and scored.'" "$PLIST"
  ok "speech recognition description added"
fi

SCHEME=$(node -e "
const fs=require('fs');
const s=fs.readFileSync('src/native/googleAuth.js','utf8');
console.log((s.match(/OAUTH_SCHEME\s*=\s*[\"']([^\"']+)/)||[])[1]||'');
")
[[ -n "$SCHEME" ]] || die "Could not read OAUTH_SCHEME from src/native/googleAuth.js"

if $PB -c "Print :CFBundleURLTypes" "$PLIST" >/dev/null 2>&1 && \
   $PB -c "Print :CFBundleURLTypes" "$PLIST" | grep -q "$SCHEME"; then
  skip "URL scheme $SCHEME present"
else
  plist_has CFBundleURLTypes || $PB -c "Add :CFBundleURLTypes array" "$PLIST"
  $PB -c "Add :CFBundleURLTypes:0 dict" "$PLIST" 2>/dev/null || true
  $PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST" 2>/dev/null || true
  $PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $SCHEME" "$PLIST"
  ok "URL scheme $SCHEME added"
fi

# --------------------------------------------------- 7. android permissions
if [[ $ANDROID -eq 1 ]]; then
  say "Adding the Android microphone permission and URL scheme"
  node scripts/patch-android-manifest.mjs && ok "AndroidManifest.xml patched"
fi

# ------------------------------------------------------------- 8. sync + go
say "Syncing the web build into the native projects"
npx cap sync
ok "synced"

cat <<EOF

$(printf "\033[1;32mDone with the parts a script can do.\033[0m")

THREE THINGS ONLY YOU CAN DO NOW
────────────────────────────────
1. SUPABASE  IN A WEB BROWSER, not in this Terminal window.

             supabase.com/dashboard → your project → Authentication (left
             sidebar) → URL Configuration → Redirect URLs → "Add URL".

             Type this into the box on that page, then Save:

                 ${SCHEME}://auth-callback

             Miss this and Google sign-in fails silently on the phone.

2. XCODE     Run:   npm run cap:ios
             Xcode opens. In the left sidebar click the blue "App" icon, then the
             "Signing & Capabilities" tab. Tick "Automatically manage signing" and
             pick your team in the dropdown. That is all you touch in Xcode.

3. TEST      Plug your iPhone in, pick it at the top of the Xcode window, press
             the ▶ play button. The app installs on your phone.
             Then work through the checklist in docs/capacitor-runbook.md —
             especially: does "Coach me through a situation" return a plan, and
             does the mic actually produce text.

If something failed above, nothing is stranded. Fix it and run this script again.
EOF
