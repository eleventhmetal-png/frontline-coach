# Turning Frontline Coach into an iPhone app

Read this top to bottom once before you touch anything. Total time is maybe two hours, but most of that is Xcode downloading while you do something else.

Nothing here can break the website. The live site keeps running exactly as it does now.

---

## Before you start: install two things

**1. Xcode** — App Store → search "Xcode" → Install. It's about 7GB, so start it now and go do something else. When it finishes, **open it once** and accept the licence agreement. It won't work until you do.

**2. CocoaPods** — open Terminal and paste:

```
brew install cocoapods
```

If that says `brew: command not found`, use this instead:

```
sudo gem install cocoapods
```

It'll ask for your Mac password. Typing shows nothing on screen — that's normal, just type it and hit return.

---

## Step 1 — Check one thing first

Go to App Store Connect. If you've already created the app there, find its **Bundle ID** and compare it to this:

```
com.otsmedia.frontlinecoach
```

- **Same, or you haven't created the app yet?** Carry on.
- **Different?** Tell me the real one and I'll change it before you go further.

This matters because a Bundle ID is permanent once you submit a build. Getting it wrong means starting a new app listing from scratch.

---

## Step 2 — Run one command

Open Terminal. Paste these two lines, one at a time:

```
cd ~/Documents/Claude/Projects/frontline-coach-app
bash scripts/native-setup.sh
```

It will ask you to confirm the Bundle ID. Type `y` and hit return.

Then it runs for a few minutes and prints a list of `✓` marks. It handles: installing the plugins, switching on the native code, the Supabase auth setting, building, creating the iOS project, and the microphone and sign-in permissions.

**If it stops with a red STOP message, read it — it tells you exactly what to fix.** Then run the same command again. Running it twice is safe; it skips anything already done.

---

## Step 3 — One setting in Supabase

**This one happens in a web browser, not in Terminal.** It's a value you type into a box on a web page. Pasting it into Terminal just gets you `zsh: no such file or directory`.

1. Go to **supabase.com/dashboard** and open your Frontline Coach project
2. Left sidebar → **Authentication**
3. Then **URL Configuration**
4. Scroll to **Redirect URLs** — there'll already be entries like `https://frontline-coach.com/**`
5. Click **Add URL**, type this into the box, and **Save**:

```
frontlinecoach://auth-callback
```

Skip this and Google sign-in will fail on the phone with no error message at all. Easiest thing in here to forget.

---

## Step 4 — Open Xcode and sign the app

Back in Terminal:

```
npm run cap:ios
```

Xcode opens. It looks overwhelming. You only touch one screen:

1. In the left sidebar, click the blue **App** icon at the very top.
2. Click the **Signing & Capabilities** tab across the middle.
3. Tick **Automatically manage signing**.
4. In **Team**, pick your Apple developer account.

That's it. Close nothing, change nothing else.

---

## Step 5 — Put it on your phone

1. Plug your iPhone into the Mac with a cable.
2. At the top of the Xcode window there's a dropdown that probably says "iPhone 15 Simulator". Click it and pick **your actual phone**.
3. Press the **▶** play button, top left.
4. First time only, your phone will say the developer isn't trusted. On the phone: Settings → General → VPN & Device Management → tap your account → Trust.

The app installs and opens.

---

## Step 6 — Test these six things on the phone

This is the part that actually matters. None of it can be checked in a browser.

1. **Coach me through a situation** → type a real situation → does a plan come back?
   If it says "No reply came back," the app can't reach its backend. Tell me and I'll fix it.
2. **Practice → tap the mic** → does it ask permission when you *tap*, not at launch? Then does your speech turn into text *while* you talk?
3. **Practice → read aloud** → does the employee's reply play out loud in a real voice?
4. **Sign out, then Continue with Google** → does real Safari open (not a window inside the app), and do you come back signed in?
5. **Look for the word BETA** anywhere — header, sign-in screen, pricing page. There should be none.
6. **Force-quit the app and reopen it** → still signed in? Everything still there?

Tell me which of the six fail and I'll fix them. Don't try to fix them yourself.

---

## What's left after that

Two things, neither of them code:

- **A reviewer demo account.** Apple's reviewer has to be able to sign in. If sign-ups are capped or closed when they test, they can't get in, and the app gets rejected for that alone. This is the real remaining blocker.
- **Check your Play Console account type.** If it says "personal" rather than "organisation," Google requires 12 testers for 14 straight days before you can go live — which changes your November timing. Worth two minutes to look.

---

## Android

Skipped on purpose. One store at a time — iOS review is the harder one and the bigger risk. Once the iPhone app is on your phone and working, come back and run:

```
bash scripts/native-setup.sh --android
```

That needs Android Studio installed first.
