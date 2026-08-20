// Post-build step for `npm run build:store` ONLY. Two jobs:
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
// Apple Guideline 2.2: "Apps that are still in a demo, trial, or test version will be
// rejected." See src/storeBuild.js.
//
//   node scripts/store-clean.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
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
  [
    '<a href="/pricing">what it costs</a> after the beta (a seven-day free',
    '<a href="/pricing">what it costs</a> after that (a seven-day free',
  ],
  // SERVICE WORKER. Inside a native binary a service worker caching the app shell
  // fights Capacitor's own asset loader, and a cached shell can outlive an app
  // update — the user installs a new version and still runs the old bundle, with no
  // way to clear it short of deleting the app. Native builds get their assets from
  // the container, so the SW buys nothing here and costs a class of bug that is
  // almost impossible to diagnose from a store review.
  ['if ("serviceWorker" in navigator) {', "if (false) {"],
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
  } else if (!html.includes(to)) {
    // Neither the original nor the replacement is present, so the copy moved and
    // this rule is silently doing nothing — the exact failure this guard exists to
    // catch. (If `to` IS present we already ran on this dist; that's fine, skip.)
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
