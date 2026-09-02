// =====================================================
// EXTERNAL LINK SEAM
// =====================================================
// Opens a URL OUTSIDE the app. Same registration pattern as registerOAuthDriver in
// ./oauthDriver.js and setLegalOpener in ./legalSheet.js, and for the same reason: the
// native implementation needs @capacitor/* imports, and App.jsx must not import those —
// Vite resolves even a lazy import at build time, so a dynamic import inside a click
// handler would still break `npm run build` on a machine without the plugins installed.
//
// WHY THIS EXISTS AT ALL: an <a href> or window.open to an external site does not work
// inside Capacitor's WKWebView. Either nothing happens (the target="_blank" trap that
// made every legal link a dead tap — see src/LegalModal.jsx) or the webview navigates
// away from the app with no chrome to come back with. Neither is acceptable for the one
// link that leads to a purchase.
//
// GUIDELINE 3.1.1(a): on the US storefront an app may link out to the developer's own
// checkout, with no entitlement required. What it may NOT do is take the payment inside
// the app. So this is the sanctioned shape, and the only one the store build uses.

let opener = null;

// driver: { open(url): Promise<void> }
export function registerExternalOpener(d) {
  if (d && typeof d.open === "function") opener = d;
}

export function hasExternalOpener() {
  return !!opener;
}

// Returns true if the link was handed off. On the web there is nothing to register and
// the default path is a normal new tab, which works.
export async function openExternal(url) {
  if (!url) return false;
  if (opener) {
    try {
      await opener.open(url);
      return true;
    } catch (e) {
      // Fall through to the web path rather than failing silently. A purchase link that
      // does nothing is worse than one that opens in the wrong place.
      console.error("external open failed, falling back:", e);
    }
  }
  try {
    const w = window.open(url, "_blank", "noopener");
    if (w) return true;
  } catch (e) { /* ignore */ }
  try {
    window.location.href = url;
    return true;
  } catch (e) {
    return false;
  }
}
