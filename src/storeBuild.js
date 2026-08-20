// APP STORE GUIDELINE 2.2: "Apps that are still in a demo, trial, or test version
// will be rejected." The word "beta" is honest on the web, where it sets expectations
// with pilot users, and it is a rejection flag inside a submitted binary — and inside
// every screenshot taken from one.
//
// So beta wording is a build switch, not a delete. This flag lives in its own module
// because both App.jsx and AuthGate.jsx need it, and the sign-in screen is the FIRST
// surface a reviewer sees.
//
//   npm run build         → Netlify / PWA. Flag off. Beta wording shown.
//   npm run build:store   → Capacitor / App Store / Play. Flag on. Beta wording hidden.
//
// Never set VITE_STORE_BUILD in .env — that would strip the beta framing from the web
// app, where pilot users are relying on it.
export const IS_STORE_BUILD = import.meta.env.VITE_STORE_BUILD === "1";
