# Capacitor runbook

Everything here runs on the Mac. Written 19 Aug 2026.

**Do not run `npm install` for this project inside a Linux container or sandbox.** This repo has already been broken once that way — see the `package-lock.json` note in `.gitignore`. Cross-platform `node_modules` contamination produced an `Invalid Version` error on Netlify's build. Mac only.

---

## 1. Confirm the bundle ID before anything else

`capacitor.config.json` currently says:

```
com.otsmedia.frontlinecoach
```

**Check this against App Store Connect and Play Console and change it now if it differs.** A bundle ID is permanent once a build is submitted. Renaming it later means a new app listing, a new Play entry, and losing anything attached to the old one.

## 2. Install

```bash
npm install @capacitor/core @capacitor/ios @capacitor/android \
            @capacitor/app @capacitor/browser \
            @capacitor-community/speech-recognition
npm install -D @capacitor/cli
```

Versions are deliberately not pinned in `package.json` — let npm resolve current ones rather than trusting a number written from memory.

## 3. Activate the native code

Four files under `src/native/` are written but **unreferenced on purpose**, so the web build keeps working before the plugins exist. Vite only resolves what the entry graph reaches.

Add to `src/main.jsx`, above the `ReactDOM.createRoot` call:

```js
import { initNative } from "./native";
initNative();
```

Safe on web — `isNative()` is false there and it returns having done nothing.

After this line exists, **both** builds need the plugins installed. Step 2 is not optional any more.

## 4. Switch Supabase to PKCE

`src/lib/supabaseClient.js` does not set `flowType`, and the default differs across supabase-js versions. Native Google sign-in requires PKCE:

```js
auth: {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: "pkce",
}
```

This was left unchanged deliberately — it affects the web app too, and you said nothing should ship to beta users yet. It is low risk (PKCE is Supabase's recommended setting and existing sessions survive), but it is a production auth change, so make it when you're ready to deploy web and test native together.

**If you skip this**, native Google sign-in fails in the most confusing way available: the browser opens, Google succeeds, the deep link fires with tokens in the URL *fragment* instead of a `?code`, `exchangeCodeForSession` finds nothing, and sign-in hangs with no error.

## 5. Add the platforms

```bash
npx cap add ios
npx cap add android
```

## 6. Native config the plugins can't do for you

### iOS — `ios/App/App/Info.plist`

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Frontline Coach uses the microphone so you can practise a conversation out loud instead of typing it.</string>

<key>NSSpeechRecognitionUsageDescription</key>
<string>Speech recognition turns what you say in a practice conversation into text so it can be coached.</string>

<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>frontlinecoach</string></array>
  </dict>
</array>
```

Write those two usage strings carefully. Apple rejects vague purpose strings under Guideline 5.1.1, and "we need the microphone" is the canonical example of one.

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

and inside the main `<activity>`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="frontlinecoach" />
</intent-filter>
```

### Supabase dashboard

Authentication → URL Configuration → Redirect URLs, add:

```
frontlinecoach://auth-callback
```

Miss this and Supabase silently drops the redirect and returns to the Site URL instead.

**Three places hold the same scheme: Info.plist, AndroidManifest.xml, and Supabase. All three, or sign-in breaks silently.** The constant lives in `src/native/googleAuth.js` as `OAUTH_SCHEME`.

## 7. Build and open

```bash
npm run cap:ios       # build:store, cap sync, open Xcode
npm run cap:android   # same, opens Android Studio
```

`cap:sync` runs `build:store`, so the Guideline 2.2 beta check and the API-base check both gate every native build. If either fails, nothing syncs.

---

## On-device checklist

Browser testing will not catch any of these.

- [ ] **AI calls work.** Coach me through a situation returns a plan. If it says "No reply came back", `VITE_API_BASE` is wrong — relative `/api/*` resolves against the bundle. This is what `src/lib/apiBase.js` exists for.
- [ ] **Dictation works.** Tap the mic in Practice. Permission prompt should appear on the tap, not at launch. Then confirm text streams in as you speak, not only at the end.
- [ ] **Read-aloud works.** `/api/tts` goes through the same base.
- [ ] **Google sign-in completes.** Real Safari opens, not an in-app sheet, and the app comes back signed in. If Google shows `disallowed_useragent`, the driver didn't register — check the console for the deep-link handler error.
- [ ] **Email sign-in and password reset work.**
- [ ] **No BETA anywhere.** Header, sign-in screen, Premium footnote, usage note, and the bundled `/pricing` page.
- [ ] **Account deletion works** (Guideline 5.1.1(v)) — it goes through `/api/delete-account`, so it depends on the API base too.
- [ ] **Kill and relaunch.** Confirm the session persists and you aren't served a stale bundle. `store-clean.mjs` disables the service worker in store builds specifically to prevent a cached shell outliving an app update.

## Still open, not code

- **Reviewer demo account.** Credentials in App Review Information. If sign-ups are capped or closed when a reviewer tests, they cannot get in, and that is a Guideline 2.1 rejection — harder than 2.2. This is the last real blocker.
- **Verify the Play account type.** Organisation accounts are exempt from the 12-testers-for-14-consecutive-days rule; personal accounts created after 13 Nov 2023 are not. OTS Media LLC with a D-U-N-S should be an organisation, but confirm in Play Console. If it reads personal, that clock has to start well before 15 November.
