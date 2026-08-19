// Node loader hooks so the app's own source can be imported outside Vite.
// Two Vite-isms have to be papered over: extensionless relative imports, and
// import.meta.env. Nothing here is used by the app itself.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(spec, ctx, next) {
  if (spec.startsWith(".") && !/\.(m?js|json)$/.test(spec)) {
    const base = new URL(spec, ctx.parentURL);
    for (const ext of [".js", ".mjs", "/index.js"]) {
      const cand = new URL(base.href + ext);
      if (existsSync(fileURLToPath(cand))) return next(cand.href, ctx);
    }
  }
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.startsWith("file:") && url.includes("/src/")) {
    const src = readFileSync(fileURLToPath(url), "utf8")
      .replace(/import\.meta\.env/g, "globalThis.__VITE_ENV__");
    return { format: "module", source: src, shortCircuit: true };
  }
  return next(url, ctx);
}
