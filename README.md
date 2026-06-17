# Frontline Coach — Live App (Netlify)

The working app, packaged to run on a real public URL with your own API key.
The key stays on the server (in `netlify/functions/claude.mjs`, read from an environment
variable). It never touches the browser. Follow that and you're safe.

---

## Step 1 — Get your API key (5 minutes)

1. Go to **console.anthropic.com** and create an account.
   (Separate from your Claude chat plan. The account is free.)
2. Add a small amount of billing credit — **$10 is plenty** to start. You only pay per use.
3. Create an **API key**. Copy it once, keep it safe. It looks like `sk-ant-...`.
   Treat it like a password. Never paste it into code, chat, or a screenshot.

---

## Step 2 — Put it live on Netlify

1. Put this whole folder into a **GitHub repo** (you already have GitHub connected).
2. Go to **netlify.com**, sign in with GitHub, click **Add new site → Import an existing project**.
3. Pick the repo. Netlify reads `netlify.toml`, so the build settings fill in automatically:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. Before the first deploy, open **Site settings → Environment variables** and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your `sk-ant-...` key
5. Deploy. In about a minute you get a public URL like `frontline-coach.netlify.app`.
6. Open it, run the Coach tool. If it answers, the key is wired correctly.
7. Add your own domain later under **Domain settings**.

That URL is what goes in your YouTube description and behind the landing page's "Start free" button.

---

## How the pieces connect

- The app calls `/api/claude` in the browser.
- `netlify.toml` redirects `/api/claude` to the function at `/.netlify/functions/claude`.
- The function adds your key (from the environment variable) and calls Claude.
- The key only ever exists on Netlify's servers.

---

## Run it on your own computer first (optional)

1. Install Node.js (nodejs.org) and the Netlify CLI: `npm i -g netlify-cli`
2. In this folder: `npm install`
3. Copy `.env.example` to `.env` and paste your key into it.
4. Run: `netlify dev` — this serves the app AND the function together locally.
   (Plain `npm run dev` runs the front end only; the AI won't answer without the function.)

---

## What this version does NOT have yet

- No user accounts / login
- No paywall or Stripe billing
- No saved history (roleplay resets on refresh)

On purpose. This is the slice that gets the real tool into a manager's hands so you can watch
whether they actually use it. Accounts and billing come after that, not before.

---

## Files

- `src/App.jsx` — the entire app (all six tools, share card, the AI voice prompts)
- `netlify/functions/claude.mjs` — the server function that holds your key and calls Claude
- `netlify.toml` — build settings and the /api/claude route
- everything else — standard Vite + Tailwind setup
