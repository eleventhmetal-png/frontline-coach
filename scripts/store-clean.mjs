// Post-build step for `npm run build:store` ONLY. Four jobs:
//
//   1. Rewrite the beta wording in dist/index.html. That file is the app's entry
//      document and its prerendered <body> block exists for search crawlers, who
//      never see a Capacitor binary — but a reviewer viewing source, or a slow first
//      paint, does. It is a hand-maintained static file, so Vite gives us no hook to
//      template it. Rewriting the built copy keeps the source correct for the web.
//
//   2. GUARD. Scan all of dist/ for any surviving "beta" and fail the build if one
//      turns up outside the allowlist. This is the part that matters. The header
//      badge had a working Guideline 2.2 switch for weeks that nothing ever set, and
//      four more surfaces were never gated at all. A build that fails loudly is the
//      only thing that stops that recurring.
//
//   3. Delete the marketing pages from dist/. They are web SEO pages, nothing inside
//      the app links to them, and pricing.html advertises a $14.99 subscription sold
//      off-platform. Shipping that inside the binary is Guideline 3.1.1 surface for no
//      benefit. privacy.html and terms.html STAY — the consent sheet and the sign-in
//      screen link to them and Apple requires them reachable.
//
//   4. GUARD. Fail the build if a price survives anywhere in dist/. Apple asked
//      "explain your business model" on 25 Aug 2026 (Guideline 2.1(b)) because the
//      binary still carried a Stripe checkout. The store build sells nothing, and this
//      is what keeps that true when someone adds a price string six months from now.
//
// Apple Guideline 2.2: "Apps that are still in a demo, trial, or test version will be
// rejected." See src/storeBuild.js.
//
//   node scripts/store-clean.mjs

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

// Exact strings, not regexes, so a silent no-op is impossible to miss: every entry
// must match or the script fails. If copy in index.html changes, this list changes.
const REWRITES = [
  [
    "Free for all users during the beta, which runs to 15 November 2026.",
    "Free for all users right now, through 15 November 2026.",
  ],
  [
    "Free for everyone during the beta — no card, no limits.",
    "Free for everyone right now — no card, no limits.",
  ],
  // PRICING CLAUSE, removed outright rather than reworded. Guideline 3.1.1: a store
  // build must not point at a purchase made outside the App Store, and pricing.html is
  // deleted from dist below, so the link would be dead in the binary regardless. The
  // clause lives on one line in index.html for exactly this reason — see the comment
  // there. This rule also carries the word "beta", so 2.2 is covered by the deletion.
  [
    '<span>See <a href="/pricing">what it costs</a> after the beta (a seven-day free trial, then $14.99 a month).</span>',
    "",
  ],
  // Same reason, in the JSON-LD Offer description. Rule 1 above already rewrote the
  // first sentence of this same string; this strips the pricing sentence that follows it.
  [
    " After that, a seven-day free trial with no card required, then $14.99 per month or $119 per year.",
    "",
  ],
  // SERVICE WORKER. Inside a native binary a service worker caching the app shell
  // fights Capacitor's own asset loader, and a cached shell can outlive an app
  // update — the user installs a new version and still runs the old bundle, with no
  // way to clear it short of deleting the app. Native builds get their assets from
  // the container, so the SW buys nothing here and costs a class of bug that is
  // almost impossible to diagnose from a store review.
  ['if ("serviceWorker" in navigator) {', "if (false) {"],
  // PINCH-ZOOM. A native app shell has no business zooming. Reported 21 Aug 2026:
  // an accidental pinch left the whole app scaled up and panned, with the header
  // under the status bar and the left edge cut off — and pinching back out did not
  // recover it. Only a force-quit did, because WKWebView zoom state dies with the
  // process but nothing in the page can reset it.
  //
  // This is a review risk, not just an annoyance. A reviewer who does it by accident
  // sees a broken layout and files it as a Guideline 2.1 bug.
  //
  // Store binary only. The web build keeps pinch-zoom, because on a real web page
  // removing it is an accessibility regression for low-vision users. In the app,
  // iOS system-wide Accessibility Zoom still works and is the right mechanism.
  [
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />',
  ],
];

// Backend identifiers. Invisible to a user and to a reviewer, and renaming them would
// mean a Supabase RPC rename and a Netlify Forms rename for zero review benefit.
const ALLOWED = ["beta_status", "beta-waitlist", "beta-full"];

const indexPath = join(dist, "index.html");
let html = readFileSync(indexPath, "utf8");
const missing = [];
let rewrote = 0;
for (const [from, to] of REWRITES) {
  if (html.includes(from)) {
    html = html.split(from).join(to);
    rewrote++;
  } else if (to === "" || !html.includes(to)) {
    // Neither the original nor the replacement is present, so the copy moved and
    // this rule is silently doing nothing — the exact failure this guard exists to
    // catch. (If `to` IS present we already ran on this dist; that's fine, skip.)
    //
    // A deletion rule (to === "") gets no "already ran" escape hatch: every string
    // contains "", so `html.includes(to)` is true for free and a moved string would
    // sail straight through. A deletion must match on this run or the build fails.
    missing.push(from);
  }
}
if (missing.length) {
  console.error("store-clean: these index.html strings no longer match:");
  for (const m of missing) console.error(`  - ${m}`);
  console.error("Update REWRITES in scripts/store-clean.mjs to match the new copy.");
  process.exit(1);
}
writeFileSync(indexPath, html);
console.log(`store-clean: rewrote ${rewrote} beta string(s) in dist/index.html`);

// ---- marketing pages ----
// BEFORE the guards, not after: these files are leaving, so there is no sense in
// letting them fail a scan on their way out. Slugs come from PAGES in
// src/pageContent.js, listed literally so this file stays dependency-free.
//
// GUIDELINE 3.1.1. pricing.html advertises a $14.99 subscription sold through Stripe
// on the web. Inside the binary that is steering to a purchase outside the App Store,
// and it is part of why the 25 Aug 2026 submission drew the 2.1(b) "explain your
// business model" question. The rest are web SEO pages that nothing in the app links
// to. privacy.html and terms.html STAY — the consent sheet and the sign-in screen link
// to them, and Apple requires both reachable.
const MARKETING = [
  "pricing",
  "operator",
  "new-manager-coach",
  "employee-pushback",
  "difficult-employee-conversations",
  "standard-slipping",
  "manager-roleplay",
  "manager-documentation",
];
let removed = 0;
for (const slug of MARKETING) {
  const p = join(dist, `${slug}.html`);
  if (existsSync(p)) { rmSync(p); removed++; }
}
console.log(`store-clean: removed ${removed} marketing page(s) from dist/ (privacy.html and terms.html kept)`);

// ---- guard ----
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const TEXT = /\.(html|js|css|json|webmanifest|txt|xml|svg)$/i;
const findings = [];

for (const file of walk(dist)) {
  if (!TEXT.test(file)) continue;
  const text = readFileSync(file, "utf8");
  // Blank the allowlisted identifiers, then anything left is a real finding.
  let scrubbed = text;
  for (const a of ALLOWED) scrubbed = scrubbed.split(a).join("");
  let m;
  const re = /beta/gi;
  while ((m = re.exec(scrubbed))) {
    const start = Math.max(0, m.index - 70);
    findings.push({
      file: relative(root, file),
      context: scrubbed.slice(start, m.index + 70).replace(/\s+/g, " "),
    });
  }
}

if (findings.length) {
  console.error(`\nstore-clean: FAILED — ${findings.length} "beta" occurrence(s) left in dist/`);
  console.error("Guideline 2.2 rejects apps presented as a beta. Gate these behind");
  console.error("IS_STORE_BUILD (src/storeBuild.js) or add to ALLOWED if backend-only.\n");
  for (const f of findings.slice(0, 25)) {
    console.error(`  ${f.file}\n    ...${f.context}...`);
  }
  if (findings.length > 25) console.error(`  (+${findings.length - 25} more)`);
  process.exit(1);
}

// ---- API base guard ----
// A store build whose backend calls are still relative passes every local check and
// then fails on a reviewer's phone: no AI replies, no read-aloud, no checkout. The
// symptom is the app's generic catch message, which looks like a server problem
// rather than a build problem. Cheaper to fail here.
const bundles = walk(join(dist, "assets")).filter((f) => f.endsWith(".js"));
const bundleText = bundles.map((f) => readFileSync(f, "utf8")).join("");
const base = process.env.VITE_API_BASE || "https://frontline-coach.com";

if (!bundleText.includes(base)) {
  console.error(`\nstore-clean: FAILED — the API base "${base}" is not in the bundle.`);
  console.error("Backend calls must go through apiUrl() from src/lib/apiBase.js.");
  console.error("A relative /api/* path resolves against the app bundle on device");
  console.error("and every AI call fails. See src/lib/apiBase.js.\n");
  process.exit(1);
}

const relativeCalls = [...bundleText.matchAll(/fetch\(\s*["']\/api\//g)].length;
if (relativeCalls) {
  console.error(`\nstore-clean: FAILED — ${relativeCalls} relative fetch("/api/...") call(s) in the bundle.`);
  console.error("Wrap them in apiUrl(). See src/lib/apiBase.js.\n");
  process.exit(1);
}

console.log(`store-clean: API base ${base} present, no relative /api calls`);
console.log("store-clean: PASS — no user-visible beta wording in dist/");

// ---- price guard ----
// GUIDELINE 3.1.1. A store build must contain no purchase path and no steering to
// one. `Paywall` is gated by IS_STORE_BUILD in App.jsx, `startCheckout` is unreachable
// there, and the pricing page is gone — so no price should exist anywhere in dist. If
// one turns up, a surface was added without a store gate, which is exactly how the
// Stripe checkout survived into the 25 Aug 2026 submission.
//
// HTML ONLY, deliberately. The JS bundle still contains the paywall's price strings:
// they sit in the branch IS_STORE_BUILD skips, and whether the minifier folds that
// branch away is an implementation detail of esbuild's cross-module constant inlining,
// not something to hang a build failure on. Dead code is not a review surface — a
// reviewer cannot reach it. Static HTML is the opposite: it is a page they can open.
const PRICES = ["$14.99", "$119", "$7.99", "14.99/mo"];
const priceFindings = [];
for (const file of walk(dist)) {
  if (!/\.html$/i.test(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const p of PRICES) {
    if (text.includes(p)) priceFindings.push({ file: relative(root, file), price: p });
  }
}
if (priceFindings.length) {
  console.error(`\nstore-clean: FAILED — ${priceFindings.length} price string(s) left in dist/`);
  console.error("Guideline 3.1.1: a store build must not sell anything or point at an");
  console.error("external purchase. Gate the surface behind IS_STORE_BUILD (src/storeBuild.js).\n");
  for (const f of priceFindings.slice(0, 25)) console.error(`  ${f.file} — ${f.price}`);
  process.exit(1);
}
console.log("store-clean: PASS — no prices in dist/");
