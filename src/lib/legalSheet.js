// =====================================================
// LEGAL VIEWER SEAM
// =====================================================
// Same pattern as setConsentAsker in ./aiConsent.js and registerDictationDriver in
// ./voice.js, and for the same reason: the links live four components deep — inside
// DataAndPrivacy, MoreView and the consent sheet — and threading a setState down
// through all of them to open one modal is churn for nothing.
//
// The shell registers an opener at mount; anything anywhere calls openLegal().
//
// No dependencies, so this is safe to import from any module.

let opener = null;

export function setLegalOpener(fn) {
  opener = typeof fn === "function" ? fn : null;
}

// view: "terms" | "privacy". Returns false if no shell registered an opener, so a
// caller could fall back — nothing does today, and a dead tap is exactly the bug
// this replaced, so failing visibly in the console beats failing silently.
export function openLegal(view = "terms") {
  if (!opener) {
    console.warn("openLegal called with no viewer registered");
    return false;
  }
  opener(view);
  return true;
}
