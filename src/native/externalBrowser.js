import { Browser } from "@capacitor/browser";

// =====================================================
// EXTERNAL BROWSER — the Guideline 3.1.1(a) link-out
// =====================================================
// Registered by ./index.js at boot on device, through the seam in ../lib/externalLink.js.
// Only ever used for one thing: opening https://frontline-coach.com/subscribe so somebody
// can pay on the web.
//
// WHY @capacitor/browser AND NOT window.open OR AN ANCHOR
// Inside WKWebView an external <a href> or window.open either does nothing at all — the
// target="_blank" trap that made every legal link in this app a dead tap, see
// src/LegalModal.jsx — or it navigates the webview away from the app, leaving the user
// stranded with no back button and no address bar. For a link that leads to a purchase,
// both outcomes cost money.
//
// Browser.open() presents SFSafariViewController: a real browser with a visible URL, a
// Done button, and Safari's own cookie jar. The visible URL matters beyond usability — the
// user can see they are on frontline-coach.com before typing card details, which is the
// difference between a link-out and something that looks like phishing.
//
// The plugin is already a dependency (it was added for the Google OAuth hand-off), so this
// costs no new native install. That matters: every plugin added to this project has cost a
// day — the force-unwrap crash in the speech plugin, and SPM-vs-CocoaPods silently killing
// dictation. Reusing an installed one is worth more than a marginally better API.
//
// WHAT THIS DELIBERATELY DOES NOT DO: carry the session across. The user signs in again in
// Safari, because the app's webview cookies are not Safari's. A one-time magic link would
// fix that and needs a server endpoint minting Supabase links — worth building if the
// hand-off measurably costs conversions, not before.
export const capacitorExternal = {
  async open(url) {
    await Browser.open({
      url,
      // Matches the app's own chrome so the transition does not look like an error.
      toolbarColor: "#0a0a0a",
      // iOS only. `popover` on iPad, full sheet on iPhone — the default on iPhone is a
      // partial sheet that can be dismissed by accident mid-payment.
      presentationStyle: "fullscreen",
    });
  },
};
