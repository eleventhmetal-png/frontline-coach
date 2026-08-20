// Adds the microphone permission and the OAuth deep-link intent-filter to
// AndroidManifest.xml. Called by scripts/native-setup.sh --android.
//
// Text insertion rather than an XML library on purpose: no new dependency, and the
// manifest Capacitor generates has a known, stable shape. Every edit checks for
// itself first, so re-running changes nothing.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";

const PATH = "android/app/src/main/AndroidManifest.xml";
const SCHEME = (readFileSync("src/native/googleAuth.js", "utf8").match(
  /OAUTH_SCHEME\s*=\s*["']([^"']+)/
) || [])[1];

if (!SCHEME) {
  console.error("Could not read OAUTH_SCHEME from src/native/googleAuth.js");
  process.exit(1);
}
if (!existsSync(PATH)) {
  console.error(`${PATH} not found — did 'npx cap add android' run?`);
  process.exit(1);
}

let xml = readFileSync(PATH, "utf8");
const original = xml;

// ---- microphone permission ----
if (xml.includes("android.permission.RECORD_AUDIO")) {
  console.log("· RECORD_AUDIO already present");
} else {
  // Sits next to the INTERNET permission Capacitor always writes.
  const anchor = '<uses-permission android:name="android.permission.INTERNET" />';
  if (!xml.includes(anchor)) {
    console.error("Could not find the INTERNET permission to anchor to.");
    process.exit(1);
  }
  xml = xml.replace(
    anchor,
    `${anchor}\n    <uses-permission android:name="android.permission.RECORD_AUDIO" />`
  );
  console.log("✓ RECORD_AUDIO added");
}

// ---- deep link intent-filter ----
if (xml.includes(`android:scheme="${SCHEME}"`)) {
  console.log(`· ${SCHEME} intent-filter already present`);
} else {
  // Goes inside the main activity, after the LAUNCHER filter Capacitor writes.
  // Anchoring on </activity> would risk landing in the wrong activity if one is
  // ever added, so anchor on the launcher filter's closing tag instead.
  const marker = "</intent-filter>";
  const idx = xml.indexOf(marker);
  if (idx === -1) {
    console.error("Could not find an </intent-filter> to anchor to.");
    process.exit(1);
  }
  const insertAt = idx + marker.length;
  const filter = `

            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${SCHEME}" />
            </intent-filter>`;
  xml = xml.slice(0, insertAt) + filter + xml.slice(insertAt);
  console.log(`✓ ${SCHEME} intent-filter added`);
}

if (xml !== original) {
  copyFileSync(PATH, PATH + ".bak");
  writeFileSync(PATH, xml);
  console.log(`  (backup at ${PATH}.bak)`);
}
