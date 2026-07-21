// Generates public/terms.html and public/privacy.html from the single source
// of truth, src/legalContent.js — so the public static pages (linked from the
// landing page and used for Google OAuth verification) never drift from the
// in-app legal modal. Re-run after editing legalContent.js:
//   node scripts/gen-legal-html.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LAST_UPDATED, TERMS_SECTIONS, PRIVACY_SECTIONS } from "../src/legalContent.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function page(title, sections) {
  const body = sections
    .map(
      (s) =>
        `  <h2>${esc(s.heading)}</h2>\n` +
        s.body.map((p) => `  <p>${esc(p)}</p>`).join("\n")
    )
    .join("\n\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} — Own The Shift · Frontline Coach</title>
<style>
  body { background:#0a0a0a; color:#e5e5e5; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; margin:0; padding:0; }
  .wrap { max-width:640px; margin:0 auto; padding:32px 20px 80px; }
  h1 { font-size:22px; font-weight:800; text-transform:uppercase; letter-spacing:-0.02em; margin-bottom:4px; }
  .updated { font-size:12px; color:#6b6b6b; margin-bottom:32px; }
  h2 { font-size:15px; font-weight:700; color:#f5f5f5; margin-top:28px; margin-bottom:8px; }
  p { font-size:14px; line-height:1.6; color:#a3a3a3; margin:0 0 8px; }
  a { color:#E8923C; }
  .nav { font-size:13px; margin-bottom:24px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="nav"><a href="/terms.html">Terms</a> &nbsp;·&nbsp; <a href="/privacy.html">Privacy</a> &nbsp;·&nbsp; <a href="/">Home</a></div>
  <h1>${esc(title)}</h1>
  <div class="updated">Last updated ${esc(LAST_UPDATED)}</div>

${body}
</div>
</body>
</html>
`;
}

writeFileSync(join(root, "public/terms.html"), page("Terms of Service", TERMS_SECTIONS));
writeFileSync(join(root, "public/privacy.html"), page("Privacy Policy", PRIVACY_SECTIONS));
console.log("Wrote public/terms.html and public/privacy.html from src/legalContent.js");
