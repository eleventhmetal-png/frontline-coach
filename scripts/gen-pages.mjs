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

// Inline links are the one place raw HTML is allowed through, because a paragraph
// that can't contain a link is useless for cross-page linking. Use {p, links:[...]}
// where each entry is [textToMatch, href]; the text is escaped first, then the
// match is wrapped. Anything not listed stays escaped.
function withLinks(text, links) {
  let out = esc(text);
  for (const [label, href] of links || []) {
    out = out.replace(esc(label), `<a href="${esc(href)}">${esc(label)}</a>`);
  }
  return out;
}

function renderBlock(b) {
  if (b.h2) return `  <h2>${esc(b.h2)}</h2>`;
  if (b.h3) return `  <h3>${esc(b.h3)}</h3>`;
  if (b.p) return `  <p>${withLinks(b.p, b.links)}</p>`;
  if (b.em) return `  <p class="lead">${esc(b.em)}</p>`;
  if (b.sig) return `  <p class="sig">${esc(b.sig)}</p>`;
  if (b.ul)
    return (
      `  <ul>\n` +
      b.ul.map((li) => `    <li>${withLinks(li, b.links)}</li>`).join("\n") +
      `\n  </ul>`
    );
  if (b.belief)
    return (
      `  <p class="belief"><b>${esc(b.belief.lead)}</b> ` +
      `${esc(b.belief.rest)}</p>`
    );
  // A quoted line somebody would actually say, labelled so the reader knows
  // whether they're looking at the mistake or the fix. kind: bad | good | plain
  if (b.line)
    return (
      `  <figure class="line ${esc(b.line.kind || "plain")}">\n` +
      `    <figcaption>${esc(b.line.label)}</figcaption>\n` +
      `    <blockquote>${esc(b.line.text)}</blockquote>\n` +
      `  </figure>`
    );
  // Plan comparison. { table: { head: [...], rows: [[...], ...], highlight: n } }
  // `highlight` marks one column (0-indexed within `head`) as the recommended plan.
  // A cell of "yes" renders a tick, "no" renders a dash — everything else prints
  // as written, so a row can say "120 min/mo" instead of being forced binary.
  if (b.table) {
    const { head, rows, highlight } = b.table;
    const cell = (v) =>
      v === "yes" ? '<span class="y">&#10003;</span>'
      : v === "no" ? '<span class="n">&mdash;</span>'
      : esc(v);
    const th = head
      .map((h, i) => `<th${i === highlight ? ' class="hi"' : ""}>${esc(h)}</th>`)
      .join("");
    const tr = rows
      .map(
        (r) =>
          "        <tr>" +
          r
            .map((c, i) =>
              i === 0
                ? `<th scope="row">${esc(c)}</th>`
                : `<td${i === highlight ? ' class="hi"' : ""}>${cell(c)}</td>`
            )
            .join("") +
          "</tr>"
      )
      .join("\n");
    return (
      `  <div class="tablewrap">\n    <table>\n      <thead><tr>${th}</tr></thead>\n` +
      `      <tbody>\n${tr}\n      </tbody>\n    </table>\n  </div>`
    );
  }
  // FAQ pair. Also harvested into FAQPage JSON-LD by page().
  if (b.faq)
    return (
      `  <div class="faq">\n` +
      `    <h3>${esc(b.faq.q)}</h3>\n` +
      `    <p>${withLinks(b.faq.a, b.links)}</p>\n` +
      `  </div>`
    );
  throw new Error(`Unknown block type: ${JSON.stringify(b)}`);
}

// "Read next" links, generated from each page's `related` slug list. Exists so no
// page is reachable only via the sitemap — a page with no inbound internal links
// gets crawled late and carries no weight. Also stops this from being a hand-wired
// N-by-N linking job every time a page is added.
function relatedBlock(p) {
  if (!p.related || p.related.length === 0) return "";
  const items = p.related
    .map((slug) => {
      const target = PAGES.find((x) => x.slug === slug);
      if (!target) throw new Error(`related: no page with slug "${slug}" (on /${p.slug})`);
      return `      <li><a href="/${esc(slug)}">${esc(target.navLabel || target.h1)}</a></li>`;
    })
    .join("\n");
  return `
  <div class="related">
    <h2>Read next</h2>
    <ul>
${items}
    </ul>
  </div>
`;
}

function page(p) {
  const url = `${SITE}/${p.slug}`;

  // FAQPage is built automatically from any {faq} blocks. This is the highest-value
  // markup on a content page for AI answer engines — the Q&A pairs are what actually
  // get quoted back to somebody asking a question — so it should never depend on
  // remembering to hand-write it.
  const faqs = p.blocks.filter((b) => b.faq).map((b) => b.faq);
  const faqNode =
    faqs.length > 0
      ? [
          {
            "@type": "FAQPage",
            "@id": `${url}#faq`,
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : [];

  const graph = [
    ...p.schema,
    ...faqNode,
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
  h3 {
    font-size:17px; font-weight:700; color:#f5f5f5;
    letter-spacing:-0.01em; margin:32px 0 12px;
  }
  p { font-size:16.5px; line-height:1.7; color:#b3b3b3; margin:0 0 22px; }
  p.lead { color:#f5f5f5; font-weight:600; font-size:18px; }
  p.belief b { color:#f5f5f5; font-weight:700; }
  p.sig { color:#737373; font-size:15px; margin-top:36px; }
  ul { margin:0 0 24px; padding-left:22px; }
  li { font-size:16.5px; line-height:1.7; color:#b3b3b3; margin-bottom:10px; }
  li b, p b { color:#f5f5f5; font-weight:700; }
  a { color:var(--accent); }

  /* A line somebody would actually say. Border colour carries the verdict so it
     reads at a glance on a phone without relying on the caption. */
  figure.line {
    margin:0 0 24px; padding:16px 20px;
    background:#131313; border-left:3px solid #404040; border-radius:0 9px 9px 0;
  }
  figure.line figcaption {
    font-size:11px; font-weight:700; text-transform:uppercase;
    letter-spacing:0.12em; color:#737373; margin-bottom:9px;
  }
  figure.line blockquote {
    margin:0; font-size:16.5px; line-height:1.65; color:#e5e5e5;
  }
  figure.line blockquote::before { content:"\\201C"; }
  figure.line blockquote::after { content:"\\201D"; }
  figure.line.bad { border-left-color:#7f1d1d; }
  figure.line.bad figcaption { color:#b45454; }
  figure.line.good { border-left-color:var(--accent); }
  figure.line.good figcaption { color:var(--accent); }

  .faq { margin-bottom:8px; }
  .faq h3 { margin-top:28px; margin-bottom:8px; font-size:16px; }

  /* Comparison table. Scrolls sideways on a phone rather than crushing four
     columns into 320px — a squashed table is unreadable, a scrolling one isn't. */
  .tablewrap { overflow-x:auto; margin:0 0 28px; -webkit-overflow-scrolling:touch; }
  table { border-collapse:collapse; width:100%; min-width:520px; font-size:14px; }
  thead th {
    text-align:center; font-size:11px; font-weight:700; text-transform:uppercase;
    letter-spacing:0.1em; color:#a3a3a3; padding:10px 12px;
    border-bottom:1px solid #262626; white-space:nowrap;
  }
  thead th:first-child { text-align:left; }
  tbody th {
    text-align:left; font-weight:500; color:#d4d4d4; padding:11px 12px;
    border-bottom:1px solid #1a1a1a; font-size:14px;
  }
  tbody td {
    text-align:center; color:#b3b3b3; padding:11px 12px;
    border-bottom:1px solid #1a1a1a; white-space:nowrap;
  }
  /* The recommended column, tinted top to bottom so the eye lands on it. */
  th.hi, td.hi { background:rgba(232,146,60,0.07); }
  thead th.hi { color:var(--accent); }
  .y { color:var(--accent); font-weight:700; }
  .n { color:#525252; }

  /* Sits BELOW the CTA on purpose. Above it, the most engaged reader on the page
     gets offered another article right before being asked to try the product —
     an exit ramp at the moment of highest intent. Convert first, then offer more
     reading to the people who didn't. */
  .related { margin-top:44px; padding-top:28px; border-top:1px solid #1f1f1f; }
  .related h2 { margin-top:0; padding-top:0; border-top:none; }
  .related ul { list-style:none; padding:0; }
  .related li { margin-bottom:12px; }
  .related a { text-decoration:none; font-weight:600; }
  .related a:hover { text-decoration:underline; }
  .cta {
    margin-top:56px; padding-top:32px; border-top:1px solid #1f1f1f;
  }
  /* Scoped to .btn on purpose. A bare ".cta a" also matches the Terms and
     Privacy links in the fine print below the button, which rendered them as
     full-size orange blocks. */
  .cta a.btn {
    display:inline-block; background:var(--accent); color:#0a0a0a;
    text-decoration:none; font-weight:600; font-size:15px;
    padding:13px 30px; border-radius:9px;
  }
  .fine { font-size:12px; color:#6b6b6b; margin-top:28px; line-height:1.6; }
  .fine a { color:var(--accent); text-decoration:underline; }
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
    <a class="btn" href="/">Try Frontline Coach</a>
${p.slug === "pricing" ? `    <p class="fine" style="margin-top:14px">
      Already used your seven days?
      <a href="/?subscribe=standard">Subscribe here</a>.
    </p>
` : ""}
    <p class="fine">
      Coaching guidance only &mdash; not legal or HR advice. Always follow your
      company's policies. See our <a href="/terms.html">Terms</a> and
      <a href="/privacy.html">Privacy Policy</a>.
    </p>
  </div>
${relatedBlock(p)}
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
