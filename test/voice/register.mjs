import { register } from "node:module";
globalThis.__VITE_ENV__ = { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", MODE: "test" };
register("./hooks.mjs", import.meta.url);
