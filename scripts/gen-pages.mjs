// Generates the public static marketing pages (currently public/operator.html)
// from src/pageContent.js. Runs as part of `npm run build`, before vite, so
// Netlify regenerates them on every deploy and they can never drift from the
// content file.
//
//   node scripts/gen-pages.mjs
//
// This owns all markup and styling for these pages so adding a page means adding
// an entry to PAGES, not copy-pasting a <head> block. The five planned use-case
// pages in CONTENT-PLAN.md are meant to come through here too.
//
// NOTE: scripts/gen-legal-html.mjs still generates terms.html and privacy.html
// with its own template. Left alone on purpose — those pages are referenced by
// Google's OAuth verification and weren't worth destabilising for tidiness. Worth
// folding into this script later.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PAGES, SITE, APP_ID, WEBSITE_ID } from "../src/pageContent.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ACCENT = "#E8923C";

// Escapes text for HTML body/attribute context. Applied to every string from the
// content file so an apostrophe or ampersand in the copy can't break the markup.
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderBlock(b) {
  if (b.h2) return `  <h2>${esc(b.h2)}</h2>`;
  if (b.p) return `  <p>${esc(b.p)}</p>`;
  if (b.em) return `  <p class="lead">${esc(b.em)}</p>`;
  if (b.sig) return `  <p class="sig">${esc(b.sig)}</p>`;
  if (b.belief)
    return (
      `  <p class="belief"><b>${esc(b.belief.lead)}</b> ` +
      `${esc(b.belief.rest)}</p>`
    );
  throw new Error(`Unknown block type: ${JSON.stringify(b)}`);
}

function page(p) {
  const url = `${SITE}/${p.slug}`;
  const graph = [
    ...p.schema,
    // Reference-only stubs so this page's graph resolves standalone. The full
    // definitions live in index.html on the homepage.
    { "@type": "WebSite", "@id": WEBSITE_ID, url: `${SITE}/` },
    { "@type": "SoftwareApplication", "@id": APP_ID, name: "Frontline Coach by Own The Shift", url: `${SITE}/` },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />

<meta property="og:type" content="article" />
<meta property="og:site_name" content="Frontline Coach by Own The Shift" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${esc(p.title)}" />
<meta property="og:description" content="${esc(p.description)}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(p.title)}" />
<meta name="twitter:description" content="${esc(p.description)}" />
<meta name="twitter:image" content="${SITE}/og-image.png" />

<link rel="icon" type="image/png" href="/icon-192.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#0a0a0a" />

<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2)}
</script>

<style>
  :root { --accent: ${ACCENT}; }
  * { box-sizing: border-box; }
  body {
    background:#0a0a0a; color:#e5e5e5; margin:0;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .wrap { max-width:680px; margin:0 auto; padding:48px 24px 96px; }
  .nav { font-size:13px; margin-bottom:40px; display:flex; gap:14px; align-items:center; }
  .nav a { color:#737373; text-decoration:none; }
  .nav a:hover { color:#e5e5e5; }
  .brandline { display:flex; align-items:center; gap:9px; margin-bottom:36px; }
  .mark {
    width:30px; height:30px; border-radius:7px; background:var(--accent);
    display:flex; align-items:center; justify-content:center; flex:0 0 auto;
  }
  .mark svg { display:block; }
  .brandline span { font-size:15px; font-weight:800; letter-spacing:-0.02em; }
  .vet {
    font-size:10px; font-weight:700; text-transform:uppercase;
    letter-spacing:0.18em; color:#737373; margin-bottom:36px;
  }
  h1 {
    font-size:34px; line-height:1.15; font-weight:800;
    letter-spacing:-0.03em; margin:0 0 32px;
  }
  h2 {
    font-size:13px; font-weight:700; text-transform:uppercase;
    letter-spacing:0.14em; color:#f5f5f5;
    margin:52px 0 18px; padding-top:24px; border-top:1px solid #1f1f1f;
  }
  p { font-size:16.5px; line-height:1.7; color:#b3b3b3; margin:0 0 22px; }
  p.lead { color:#f5f5f5; font-weight:600; font-size:18px; }
  p.belief b { color:#f5f5f5; font-weight:700; }
  p.sig { color:#737373; font-size:15px; margin-top:36px; }
  .cta {
    margin-top:56px; padding-top:32px; border-top:1px solid #1f1f1f;
  }
  .cta a {
    display:inline-block; background:var(--accent); color:#0a0a0a;
    text-decoration:none; font-weight:600; font-size:15px;
    padding:13px 30px; border-radius:9px;
  }
  .fine { font-size:12px; color:#6b6b6b; margin-top:28px; }
  .fine a { color:var(--accent); }
  @media (max-width:520px) {
    h1 { font-size:28px; }
    p { font-size:16px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="nav">
    <a href="/">&larr; Frontline Coach</a>
  </div>

  <div class="brandline">
    <span class="mark"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
    <span>Own The Shift &mdash; Frontline Coach</span>
  </div>
  <div class="vet">Veteran-Owned &amp; Operated</div>

  <h1>${esc(p.h1)}</h1>

${p.blocks.map(renderBlock).join("\n")}

  <div class="cta">
    <a href="/">Try Frontline Coach</a>
    <p class="fine">
      Coaching guidance only &mdash; not legal or HR advice. Always follow your
      company's policies. See our <a href="/terms.html">Terms</a> and
      <a href="/privacy.html">Privacy Policy</a>.
    </p>
  </div>
</div>
</body>
</html>
`;
}

let count = 0;
for (const p of PAGES) {
  writeFileSync(join(root, `public/${p.slug}.html`), page(p));
  console.log(`Wrote public/${p.slug}.html`);
  count++;
}
console.log(`${count} page(s) generated from src/pageContent.js`);
