import React, { useState, useEffect } from "react";
import {
  Zap, Loader2, Mail, Lock, AlertTriangle, X, Check, Briefcase,
  MessageSquare, Shield, Play, ClipboardList, Target, FileText,
  Smartphone, ArrowRight,
} from "lucide-react";
import { supabase, supabaseReady } from "./lib/supabaseClient";
import LegalModal from "./LegalModal";
// LAST_UPDATED is still needed here — signup stamps it as tos_version.
import { LAST_UPDATED } from "./legalContent";
import { INDUSTRY_CARDS } from "./lib/industryCards";
import { IS_STORE_BUILD } from "./storeBuild";
import { APP_STORE_URL, isIOSBrowser } from "./appStore";
import { apiUrl } from "./lib/apiBase";
import { hasOAuthDriver, runOAuthDriver } from "./lib/oauthDriver";

const ACCENT = "#E8923C";

// GUIDELINE 2.2 — the signup-closed path is the highest-risk beta surface, because a
// reviewer who lands here sees the word "beta" AND cannot create an account, which
// stacks 2.2 on a 2.1 App Completeness rejection. Same behaviour either way, neutral
// noun in the store binary. See src/storeBuild.js.
//
// This copy is NOT the fix for the access problem. If sign-ups are capped or closed
// when a reviewer tests, they still need the demo account credentials in App Review
// Information to get in.
const GATE_CLOSED = IS_STORE_BUILD ? "Sign-ups are closed." : "Beta signups are closed.";
const GATE_FULL = IS_STORE_BUILD ? "Sign-ups are full right now." : "Beta is full right now.";
const GATE_CLOSED_SIGNIN = IS_STORE_BUILD
  ? "Sign-ups are closed. If you already have an account, use Sign In."
  : "Beta signups are closed. If you already have an account, use Sign In.";
const GATE_FULL_SIGNIN = IS_STORE_BUILD
  ? "Sign-ups are full right now. If you already have an account, use Sign In."
  : "Beta is full right now. If you already have an account, use Sign In.";
const GATE_CLOSED_WAITLIST = IS_STORE_BUILD
  ? "Sign-ups are closed right now."
  : "Beta signups are closed right now.";
const GATE_FULL_WAITLIST = IS_STORE_BUILD
  ? "Sign-ups are full right now."
  : "The beta is full right now.";
const SIGNUP_BLOCKED = IS_STORE_BUILD
  ? "This account can't be created right now. If you already have an account, try signing in instead."
  : "This account can't be created right now. If you're joining the beta and already have an account, try signing in instead.";

// Minimum password length enforced in the UI. Keep this >= the "Minimum password
// length" setting in Supabase (Authentication → Sign In / Providers → Email), or
// the server will reject passwords this form accepted and the user sees a raw
// API error instead of our message.
const MIN_PASSWORD = 8;

// Supabase's recovery link lands on "/" with the tokens in the URL hash, e.g.
// #access_token=...&type=recovery. supabase-js consumes and strips that hash as
// soon as it processes the URL, which can happen before our onAuthStateChange
// listener attaches — so the PASSWORD_RECOVERY event alone is not reliable.
// Capturing the hash at module load gives us a second, durable signal. Both are
// used; either one puts the app into recovery mode.
const IS_RECOVERY_LINK =
  typeof window !== "undefined" && /[#&]type=recovery/.test(window.location.hash || "");

const FEATURES = [
  { icon: MessageSquare, title: "AI Coach", desc: "Describe a people problem on your shift. Get a plan you can run today." },
  { icon: Shield, title: "Pushback Coach", desc: "Get the exact words when an employee pushes back, live." },
  { icon: Play, title: "Practice", desc: "Rehearse a hard conversation against an AI employee before the real one." },
  { icon: ClipboardList, title: "Conversation Builder", desc: "Walk into any conversation with a plan instead of winging it." },
  { icon: Target, title: "Skill vs. Will Diagnostic", desc: "Find out if it's a skill problem, a will problem — or yours." },
  { icon: FileText, title: "Documentation Assistant", desc: "Turn rough notes into a clean, factual record." },
];

// Google "G" mark, inline so we don't pull an icon-font dependency for one button.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92C16.66 14.2 17.64 11.9 17.64 9.2z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.05l3.02-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

// LegalModal moved to ./LegalModal.jsx on 25 Aug 2026 — the app needs the same
// viewer, because the in-app <a target="_blank"> links to privacy.html do nothing
// inside Capacitor's WKWebView. See the comment in that file.

/**
 * Gates the app behind Supabase auth. Renders sign-in/sign-up while
 * unauthenticated, then children (the real app) once a session exists.
 * Passes { session, profile, signOut } to children via render prop so
 * downstream code (session logging, team lookups) can use them.
 */
// =====================================================
// STORE INTRO — the signed-out screen inside the native app
// =====================================================
// The web build's signed-out screen is a full marketing landing page: hero, a
// phone mockup, feature grid, industry cards, and three links including
// "What it costs — Free now. 7-day trial, then $14.99".
//
// That page is correct on the web and WRONG inside an iOS binary, for two
// reasons that both matter:
//
//   1. GUIDELINE 3.1.1. A price for digital content, displayed in the app,
//      outside In-App Purchase. It was the first thing visible in the App Review
//      demo video — three seconds in, before the app had done anything.
//   2. It reads as a website in a wrapper, which is the exact impression
//      Guideline 4.2 rejects apps for.
//
// Someone who has downloaded the app does not need to be sold the app. They need
// to know what it is and get to a sign-in field. So: name, one line, form.
// No pricing, no hero image, no marketing links, nothing that leaves the app.
//
// This is also where account deletion lands. Deleting signs the user out, which
// unmounts the app and renders this — so the last thing they see is a clean
// sign-in screen, not a pitch to buy what they just cancelled.
// max-w-sm, wider than the form below it on purpose: at max-w-xs the name wrapped
// and left a word stranded on its own line, which reads as a mistake.
function StoreIntro({ onLegal }) {
  return (
    <div className="max-w-sm mx-auto px-6 pt-14 pb-2 text-center">
      {/* THE REAL APP ICON, not the Zap glyph the web header draws.
          public/app-icon.png is a copy of the 1024px iOS AppIcon asset, so what
          somebody sees on this screen is the same mark they just tapped on their
          home screen and the same one on the store listing. The glyph version is
          close but not identical — flat fill instead of the gradient, and a
          smaller bolt that does not bleed to the edges.
          Radius is 22.5% of the size, which is Apple's squircle proportion; the OS
          masks the real icon and this has to match it or it reads as a sticker. */}
      <img
        src="/app-icon.png"
        alt=""
        width={64}
        height={64}
        className="mx-auto mb-4"
        style={{ borderRadius: 14 }}
      />
      {/* PRODUCT NAME ONLY, and only here.
          The web landing page and the web auth form still carry the full
          "Own The Shift — Frontline Coach" lockup, because that is the string
          Google's OAuth verification compares against the consent screen's App
          name field, and Google reviews the WEBSITE — not this binary.
          Inside the app the full lockup was the odd one out: the header on Home
          says "FRONTLINE COACH", so the sign-in screen introduced a longer name
          than anything the user was about to see, and wrapped doing it. */}
      {/* Matches the Home header's treatment exactly — font-extrabold, uppercase,
          tracking-tight — just bigger, because this is the first screen and the
          header version is a 16px chrome element. There is no webfont in this
          project: Tailwind's default stack resolves to -apple-system, so both are
          SF Pro at weight 800 and they render as the same mark at two sizes.
          Do not add a Google font here to "fix" it; it would load over the network
          on a cold launch and flash unstyled text on the one screen where the app
          gets its first impression. */}
      <div className="font-extrabold uppercase tracking-tight text-3xl mb-5 leading-tight">
        Frontline Coach
      </div>

      <div className="flex items-center justify-center gap-2 mb-7">
        <Shield size={13} style={{ color: ACCENT }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
          Veteran-Owned &amp; Operated
        </span>
      </div>

      <p className="text-[15px] text-neutral-400 leading-relaxed mb-2">
        Coaching for frontline managers. Plan the hard conversation, rehearse it,
        then keep a clean record.
      </p>

      <p className="text-[11px] text-neutral-600 leading-snug mt-6">
        Coaching guidance only — not legal or HR advice. Always follow your
        company's policies.
        <br />
        {/* In-app modal, not an outbound link. A reviewer tapping Terms should not
            be thrown into Safari and out of the app. */}
        <button type="button" onClick={onLegal} className="underline mt-1.5" style={{ color: ACCENT }}>
          Terms &amp; Privacy Policy
        </button>
      </p>
    </div>
  );
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showLegal, setShowLegal] = useState(false);
  // null = still checking; { is_full, is_closed } once known. UX only -- the
  // real gate is the handle_new_user() trigger (see beta_gate migration).
  // Fails open (stays null / non-blocking) if the RPC call itself errors, so a
  // network hiccup here never wrongly locks out sign-in for existing users.
  const [betaStatus, setBetaStatus] = useState(null);
  // Waitlist state, kept separate from the auth form's email/password/error so a
  // failed signup attempt can't clobber a waitlist submission or vice versa.
  const [wlEmail, setWlEmail] = useState("");
  const [wlRole, setWlRole] = useState("");
  const [wlBusy, setWlBusy] = useState(false);
  const [wlDone, setWlDone] = useState(false);
  const [wlError, setWlError] = useState("");
  // Password recovery. `recovery` seeds from the URL hash so a missed
  // PASSWORD_RECOVERY event can't strand the user inside the app with no way to
  // set a new password.
  const [recovery, setRecovery] = useState(IS_RECOVERY_LINK);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!supabaseReady) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(sess);
    });
    supabase
      .rpc("beta_status")
      .then(({ data, error: rpcError }) => {
        if (!rpcError && data && data[0]) setBetaStatus(data[0]);
      })
      .catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);

  const signupClosed = !!(betaStatus && (betaStatus.is_full || betaStatus.is_closed));

  // Declared above the early returns on purpose: the recovery screen renders
  // before the `if (session)` hand-off to the app, and a const referenced by
  // JSX that returns earlier than its own declaration throws on render.
  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (newPassword.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (newPassword !== newPassword2) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      // The recovery link already established a valid session, so clearing the
      // recovery flag drops straight into the app — no second sign-in needed.
      setNewPassword("");
      setNewPassword2("");
      setRecovery(false);
    } catch (err) {
      setError(err.message || "Couldn't update your password. Request a new reset link and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!supabaseReady) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6">
        <div className="max-w-xs text-center space-y-3">
          <AlertTriangle className="mx-auto text-amber-500" size={28} />
          <p className="text-sm text-neutral-400">
            Auth isn't configured yet. Add <code className="text-neutral-300">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-neutral-300">VITE_SUPABASE_ANON_KEY</code> to your environment.
          </p>
        </div>
      </div>
    );
  }

  // Still checking for an existing session
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-neutral-600" size={28} />
      </div>
    );
  }

  // Password recovery takes precedence over the normal signed-in render. Clicking
  // a reset link creates a real session, so without this check the user would be
  // dropped into the app with no way to actually set a new password.
  if (recovery) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6">
        <div className="w-full max-w-xs">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT }}>
              <Zap size={16} className="text-neutral-950" />
            </div>
            <span className="font-extrabold tracking-tight text-sm">
              Own The Shift <span className="text-neutral-600 mx-0.5">—</span> Frontline Coach
            </span>
          </div>

          <h1 className="text-lg font-bold text-center mb-2">Set a new password</h1>
          <p className="text-[12px] text-neutral-500 text-center leading-snug mb-6">
            At least {MIN_PASSWORD} characters. You'll go straight into the app once it's saved.
          </p>

          <form onSubmit={handleSetPassword} className="space-y-3">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-neutral-600"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
              <input
                type="password"
                placeholder="Confirm new password"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-neutral-600"
              />
            </div>

            {error && <p className="text-[12px] text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg py-2.5 font-semibold text-sm text-neutral-950 disabled:opacity-50 flex items-center justify-center gap-2 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ backgroundColor: ACCENT }}
            >
              {busy && <Loader2 className="animate-spin" size={16} />}
              Save password
            </button>
          </form>

          <button
            type="button"
            onClick={async () => {
              setRecovery(false);
              setError("");
              try { await supabase.auth.signOut(); } catch (err) { /* ignore */ }
            }}
            className="w-full text-center text-[11px] text-neutral-600 mt-5 underline"
          >
            Cancel and sign in instead
          </button>
        </div>
      </div>
    );
  }

  // Signed in — hand off to the app
  if (session) {
    return typeof children === "function" ? children({ session, signOut: () => supabase.auth.signOut() }) : children;
  }

  const resetFeedback = () => {
    setError("");
    setNotice("");
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    resetFeedback();
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    // NOTE: the blocked-domain pre-check that used to live here was removed on
    // purpose. It hard-coded a specific employer's email domain, and everything
    // in this file ships to the browser -- the domain was findable in plain text
    // inside dist/assets/index-*.js, which publicly tied this product to that
    // company. The block itself is unaffected: handle_new_user() (see the
    // block_ccw_domain migration) is and always was the real gate, and no
    // client-side check could bypass it. The only thing lost is a tailored error
    // message; blocked signups now fall through to the generic catch below,
    // which is arguably better here since a domain-specific message is itself a
    // tell. Do not reintroduce a domain literal in client code.
    if (mode === "signup" && !tosAccepted) {
      setError("You need to accept the Terms of Service to create an account.");
      return;
    }
    if (mode === "signup" && signupClosed) {
      setError(betaStatus?.is_closed ? GATE_CLOSED : GATE_FULL);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { tos_accepted_at: new Date().toISOString(), tos_version: LAST_UPDATED },
          },
        });
        if (signUpError) throw signUpError;
        // CHECK JUNK, said explicitly and on purpose. Auth mail comes from
        // no-reply@auth.frontline-coach.com, a young sending subdomain with
        // almost no volume, and iCloud in particular files it as junk even with
        // SPF, DKIM and DMARC all in place — confirmed on a real iCloud address
        // 13 Aug 2026. Reputation builds over weeks of sending, which is not
        // something a new product has. Until it does, the person who never
        // thinks to look in junk is a signup we lost for no reason. Cheapest
        // possible recovery, so do not trim this back to one clause.
        setNotice("Check your email to confirm your account, then sign in. If it's not there in a minute, look in your junk or spam folder. It often lands there the first time.");
        setMode("signin");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      const msg = err.message || "Something went wrong.";
      // Fallback for the case the pre-check above missed a race (someone else
      // took the last slot between page load and submit) -- the trigger still
      // blocked it correctly, this just avoids surfacing a raw DB error.
      // NOTE: confirm this matches the actual error text Supabase returns for
      // a trigger-raised exception during signUp() -- GoTrue's wording for
      // this case can vary by version and wasn't verified against a live call.
      if (mode === "signup" && /database error saving new user|unexpected_failure/i.test(msg)) {
        // NOTE: same caveat as before -- this fallback now covers every
        // trigger-raised rejection: the beta cap, the close date, and the
        // blocked-domain rule. All of them surface as generic errors through
        // Supabase's signup API. Keep this message generic on purpose; naming
        // which rule fired would leak what the rules are.
        setError(SIGNUP_BLOCKED);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    resetFeedback();
    if (mode === "signup" && signupClosed) {
      setError(betaStatus?.is_closed ? GATE_CLOSED_SIGNIN : GATE_FULL_SIGNIN);
      return;
    }
    setBusy(true);
    try {
      // NATIVE: Google refuses OAuth inside an embedded webview
      // (disallowed_useragent), so signInWithOAuth() below cannot work in a
      // Capacitor build. On device a driver is registered that hands the authorize
      // URL to the real system browser and comes back through a deep link. See
      // src/lib/oauthDriver.js and src/native/googleAuth.js.
      if (hasOAuthDriver()) {
        await runOAuthDriver();
        // Leave busy set. The session arrives asynchronously via the deep link, and
        // clearing it here would re-enable the button while the browser is still up.
        return;
      }
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/" },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
      setBusy(false);
    }
  };

  // Sends the password-reset email. redirectTo must be listed under
  // Authentication → URL Configuration → Redirect URLs in Supabase, or the link
  // in the email silently bounces the user to the Site URL with no recovery
  // tokens and the reset appears to do nothing.
  //
  // Deliberately reports success even when the address has no account: telling a
  // stranger which emails are registered is an account-enumeration leak.
  const handleForgot = async (e) => {
    e.preventDefault();
    resetFeedback();
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError("Enter the email address on your account.");
      return;
    }
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(addr, {
        redirectTo: window.location.origin + "/",
      });
    } catch (err) {
      /* swallowed on purpose — see enumeration note above */
    } finally {
      setBusy(false);
      setResetSent(true);
    }
  };

  // Beta waitlist. Posts to Netlify Forms using the same urlencoded pattern as
  // submitFeedback() in App.jsx -- the matching hidden <form name="beta-waitlist">
  // must exist in index.html at build time or Netlify won't register the form and
  // every submission silently 404s. Unlike submitFeedback this checks res.ok and
  // surfaces failures, because a visitor who thinks they joined the list and
  // didn't is worse than one who knows to retry.
  const handleWaitlist = async (e) => {
    e.preventDefault();
    setWlError("");
    const addr = wlEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setWlError("Enter a valid email address.");
      return;
    }
    setWlBusy(true);
    try {
      const body = new URLSearchParams({
        "form-name": "beta-waitlist",
        email: addr,
        role: wlRole.trim().slice(0, 120),
        reason: betaStatus?.is_closed ? "signups-closed" : "beta-full",
        timestamp: new Date().toISOString(),
      });
      // Netlify Forms posts to the site root — needs the API base in a store build,
      // same as the feedback form in App.jsx. See src/lib/apiBase.js.
      const res = await fetch(apiUrl("/"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) throw new Error(`form post ${res.status}`);
      setWlDone(true);
    } catch (err) {
      setWlError("Couldn't add you to the list. Try again in a moment.");
    } finally {
      setWlBusy(false);
    }
  };

  return (
    <div
      className="h-full overflow-y-auto bg-neutral-950 text-neutral-100"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* Public landing content — reachable with no login, per Google OAuth
          verification requirements (home page not gated, explains what the
          app does, brand name distinct from a generic Google product term).
          Root app shell locks html/body/#root to a fixed viewport height for
          the in-app screens, so this outer div owns its own scroll instead of
          relying on document scroll (which is disabled globally). */}
      {/* VERTICAL CENTERING, STORE BUILD ONLY.
          min-h-full plus justify-center is the pairing that survives both cases:
          when the content is shorter than the screen it sits centered, and when it
          grows past it — Sign Up adds the terms checkbox, the waitlist form is
          taller again, and a smaller phone shrinks the room — the wrapper simply
          gets taller and the parent scrolls. Using justify-center on the scroll
          container itself instead would centre it too, right up until the content
          overflows and the top of it becomes unreachable. */}
      <div className={IS_STORE_BUILD ? "min-h-full flex flex-col justify-center" : ""}>
      {IS_STORE_BUILD ? <StoreIntro onLegal={() => setShowLegal(true)} /> : (
      <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-6 md:px-10 pt-16 pb-14">
        <div className="flex items-center gap-2 mb-10 justify-center">
          <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT }}>
            <Zap size={20} className="text-neutral-950" />
          </div>
          {/* Literal text must match the OAuth consent screen's App name field
              exactly — Google's verification check compares this string. */}
          <span className="font-extrabold tracking-tight text-lg md:text-xl">
            Own The Shift <span className="text-neutral-600 mx-1">—</span> Frontline Coach
          </span>
        </div>

        <div className="flex items-center justify-center gap-2 -mt-6 mb-10">
          <Shield size={14} style={{ color: ACCENT }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Veteran-Owned &amp; Operated</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-center leading-tight mb-5 max-w-xl mx-auto">
          Stop hoping your managers figure it out.{" "}
          <span style={{ color: ACCENT }}>Give them a system.</span>
        </h1>
        <p className="text-base text-neutral-400 text-center leading-relaxed mb-12 max-w-md mx-auto">
          Frontline Coach gives newly promoted managers and shift leads the exact words for a hard
          conversation, a place to rehearse it first, and a clean record after — built by an
          operator who runs shifts for a living, not a corporate HR vendor.
        </p>

        <img
          src="/hero-phone.png"
          alt="Frontline Coach app running on an iPhone, showing today's leadership brief and coaching tools"
          className="w-full mx-auto rounded-2xl mb-12 shadow-2xl shadow-black/50"
        />

        <p className="text-base text-neutral-400 text-center leading-relaxed mb-12 max-w-md mx-auto">
          Most frontline managers get promoted and then left on their own — no coaching training, no
          rehearsal, no plan for the conversation that's about to go sideways. Frontline Coach is
          what closes that gap, one shift at a time.
        </p>

        <button
          onClick={() => document.getElementById("auth")?.scrollIntoView({ behavior: "smooth" })}
          className="block mx-auto rounded-lg px-10 py-3.5 font-semibold text-sm mb-14 text-neutral-950 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          style={{ backgroundColor: ACCENT, boxShadow: `0 0 0 rgba(232,146,60,0)` }}
          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 10px 25px -5px ${ACCENT}66`)}
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
        >
          Get Started
        </button>

        <div className="grid md:grid-cols-2 gap-4 mb-14 max-w-xl mx-auto">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-5 transition duration-200 hover:-translate-y-1"
              style={{ transition: "box-shadow 200ms, border-color 200ms, transform 200ms" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${ACCENT}80`;
                e.currentTarget.style.boxShadow = `0 20px 45px -12px ${ACCENT}55, 0 0 30px -5px ${ACCENT}40`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <f.icon size={20} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
              <div>
                <div className="font-semibold text-sm">{f.title}</div>
                <div className="text-xs text-neutral-500 leading-snug mt-1">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Industries. Shows the breadth of settings the coach already speaks for,
            which is the answer to "is this built for someone like me." Cards carry
            the same orange glow-on-hover as the feature grid above so the page has
            one visual language. */}
        <div className="mb-14">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-center mb-2" style={{ color: ACCENT }}>
            Industries
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-center leading-tight mb-3 max-w-lg mx-auto">
            Coaching that speaks <span style={{ color: ACCENT }}>your language</span>
          </h2>
          <p className="text-sm text-neutral-400 text-center leading-relaxed mb-8 max-w-md mx-auto">
            A charge nurse and a shift lead in a tunnel are having different conversations.
            Pick your setting and the coach uses your words, your roles, and the situations you
            actually hit.
          </p>

          <div className="grid md:grid-cols-2 gap-3">
            {INDUSTRY_CARDS.map((ind) => (
              <div
                key={ind.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition duration-200"
                style={{ transition: "box-shadow 200ms, border-color 200ms, transform 200ms" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${ACCENT}80`;
                  e.currentTarget.style.boxShadow = `0 18px 40px -14px ${ACCENT}55, 0 0 26px -6px ${ACCENT}40`;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "";
                }}
              >
                <div className="font-semibold text-[15px] text-neutral-100">{ind.label}</div>
                <div className="text-xs text-neutral-500 leading-snug mt-1 mb-3">{ind.blurb}</div>
                <div className="flex flex-wrap gap-1.5">
                  {ind.situations.map((s) => (
                    <span
                      key={s}
                      className="text-[11px] rounded-full border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-neutral-400"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Authority link. Static page generated by scripts/gen-pages.mjs from
            src/pageContent.js — Netlify's Pretty URLs serve operator.html at
            /operator. Keep this in sync with the prerendered block in index.html. */}
        {/* Three links doing three different jobs — content, credibility, commercial.
            They were previously three centred sentences of identical weight, which
            flattened them and gave the eye nowhere to land. As cards they read as a
            menu, they inherit the same glow language as everything above, and the
            beta line gets to be the one thing that stands out. */}
        <div className="mb-12 max-w-xl mx-auto">
          <div className="rounded-xl border px-4 py-3 mb-3 text-center" style={{ borderColor: `${ACCENT}55`, backgroundColor: "rgba(232,146,60,0.07)" }}>
            {/* Guideline 2.2: the sign-in screen is the first surface a reviewer sees,
                so the beta framing has to come off here too. See src/storeBuild.js. */}
            <span className="text-[13px] font-semibold" style={{ color: ACCENT }}>
              {IS_STORE_BUILD ? "Free for everyone right now" : "Free for everyone during the beta"}
            </span>
            <span className="text-[13px] text-neutral-400"> — no card, no limits.</span>
          </div>

          {/* APP STORE BADGE — iOS browsers only, and only once APP_STORE_ID is set.
              Approved 25 Aug 2026. An iPhone visitor should get the real app, not the
              installable web version: it has native dictation through Apple's own
              recognizer, it survives a cold launch without the network, and it puts a
              real icon on their home screen instead of a Safari bookmark.
              NOT shown on Android — Play is still in review, so the PWA is the only
              app-shaped option there and the manifest stays exactly as it is.
              Never shown inside the native app: this whole landing block is behind
              !IS_STORE_BUILD, and isIOSBrowser() checks window.Capacitor as well. */}
          {APP_STORE_URL && isIOSBrowser() && (
            <a
              href={APP_STORE_URL}
              className="flex items-center gap-3 rounded-xl border px-4 py-3 mb-3 transition duration-200"
              style={{ borderColor: `${ACCENT}55`, backgroundColor: "rgba(232,146,60,0.07)" }}
            >
              <Smartphone size={20} style={{ color: ACCENT }} className="shrink-0" />
              <span className="flex-1 text-left">
                <span className="block text-[13px] font-semibold text-neutral-100">
                  Get it on the App Store
                </span>
                <span className="block text-[11px] text-neutral-500 leading-snug">
                  The iPhone app adds hands-free dictation. Same account, same history.
                </span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-neutral-600" />
            </a>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { href: "/new-manager-coach", icon: Play, label: "Just promoted?", sub: "Where to start when nobody trained you" },
              { href: "/operator", icon: Shield, label: "Why I built it", sub: "Eighteen years, learned the wrong way first" },
              { href: "/pricing", icon: ClipboardList, label: "What it costs", sub: "Free now. 7-day trial, then $14.99" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition duration-200"
                style={{ transition: "box-shadow 200ms, border-color 200ms, transform 200ms" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${ACCENT}80`;
                  e.currentTarget.style.boxShadow = `0 18px 40px -14px ${ACCENT}55, 0 0 26px -6px ${ACCENT}40`;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "";
                }}
              >
                <l.icon size={17} style={{ color: ACCENT }} />
                <div className="font-semibold text-sm text-neutral-100 mt-2">{l.label}</div>
                <div className="text-[11px] text-neutral-500 leading-snug mt-0.5">{l.sub}</div>
              </a>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-neutral-600 text-center mb-14 max-w-sm mx-auto">
          Coaching guidance only — not legal or HR advice. Always follow your company's policies.
          See our{" "}
          <a href="/terms.html" className="underline" style={{ color: ACCENT }}>
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy.html" className="underline" style={{ color: ACCENT }}>
            Privacy Policy
          </a>.
        </p>
      </div>
      )}

      {/* Sign in / sign up.
          In the store build the marketing page above is gone, so the divider and
          its big top margin would just be a rule under a heading. Sit the form
          straight under the intro instead. */}
      <div
        id="auth"
        className={
          IS_STORE_BUILD
            ? "pt-6 pb-16 flex items-center justify-center px-6"
            : "border-t border-neutral-900 pt-14 pb-20 flex items-center justify-center px-6"
        }
      >
      <div className="w-full max-w-xs">
        {/* StoreIntro already carries the wordmark a few pixels above this, so in
            the app it would appear twice on one short screen. */}
        {!IS_STORE_BUILD && (
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT }}>
            <Zap size={16} className="text-neutral-950" />
          </div>
          <span className="font-extrabold tracking-tight text-sm">
            Own The Shift <span className="text-neutral-600 mx-0.5">—</span> Frontline Coach
          </span>
        </div>
        )}

        <div className="flex rounded-lg border border-neutral-800 p-1 mb-6">
          {["signin", "signup"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResetSent(false); resetFeedback(); }}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                mode === m ? "bg-neutral-800 text-neutral-100" : "text-neutral-500"
              }`}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Forgot-password request. Reached from the link under the sign-in form;
            either tab above exits back out of it. */}
        {mode === "forgot" ? (
          <div>
            {resetSent ? (
              <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-3 text-[12px] text-emerald-400 leading-snug flex items-start gap-2">
                <Check size={14} className="mt-0.5 shrink-0" />
                <span>
                  If an account exists for {email.trim()}, a reset link is on its way. It
                  expires in an hour. Check your junk or spam folder if you don't see it.
                </span>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-3">
                <p className="text-[12px] text-neutral-500 leading-snug">
                  Enter the email on your account and we'll send a link to set a new password.
                </p>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                  />
                </div>

                {error && <p className="text-[12px] text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg py-2.5 font-semibold text-sm text-neutral-950 disabled:opacity-50 flex items-center justify-center gap-2 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ backgroundColor: ACCENT }}
                >
                  {busy && <Loader2 className="animate-spin" size={16} />}
                  Send reset link
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => { setMode("signin"); setResetSent(false); resetFeedback(); }}
              className="w-full text-center text-[11px] text-neutral-600 mt-5 underline"
            >
              Back to sign in
            </button>
          </div>
        ) : mode === "signup" && signupClosed ? (
          <div>
            <div className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2.5 text-[12px] text-amber-400 leading-snug">
              {betaStatus?.is_closed ? GATE_CLOSED_WAITLIST : GATE_FULL_WAITLIST}{" "}
              Leave your email and we'll tell you the moment a spot opens. Already have an
              account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signin"); resetFeedback(); }}
                className="underline font-semibold"
              >
                Sign in
              </button>
              .
            </div>

            {wlDone ? (
              <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-3 text-[12px] text-emerald-400 leading-snug flex items-start gap-2">
                <Check size={14} className="mt-0.5 shrink-0" />
                <span>
                  You're on the list. We'll email {wlEmail.trim()} when a spot opens — nothing
                  else, ever.
                </span>
              </div>
            ) : (
              <form onSubmit={handleWaitlist} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                  <input
                    type="email"
                    placeholder="Email"
                    value={wlEmail}
                    onChange={(e) => setWlEmail(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                  />
                </div>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                  <input
                    type="text"
                    placeholder="Your role (optional) — e.g. shift lead, GM"
                    value={wlRole}
                    onChange={(e) => setWlRole(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                  />
                </div>

                {wlError && <p className="text-[12px] text-red-400">{wlError}</p>}

                <button
                  type="submit"
                  disabled={wlBusy}
                  className="w-full rounded-lg py-2.5 font-semibold text-sm text-neutral-950 disabled:opacity-50 flex items-center justify-center gap-2 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ backgroundColor: ACCENT }}
                >
                  {wlBusy && <Loader2 className="animate-spin" size={16} />}
                  Join the waitlist
                </button>

                <p className="text-[11px] text-neutral-600 leading-snug">
                  One email when a spot opens. No newsletter, no sharing your address.
                </p>
              </form>
            )}
          </div>
        ) : (
          <>
        {/* APP STORE GUIDELINE 4.8 — LOGIN SERVICES. Rejected 25 Aug 2026 for
            offering Google sign-in with no equivalent option (Apple's example of
            an equivalent is Sign in with Apple: name and email only, private
            relay address, no ad tracking without consent).
            4.8 only bites when the app offers a THIRD-PARTY login service.
            Email and password is first-party, so hiding this button in the store
            binary removes the obligation outright — no Services ID, no signing
            key, no Supabase Apple provider, nothing new that can fail in review.
            The WEB app keeps Google: the guideline is an App Store rule and
            pilot users signed up with it.
            DO NOT delete this button or handleGoogle. When Sign in with Apple
            ships, drop the !IS_STORE_BUILD and put SIWA beside it — that is the
            outcome 4.8 actually wants, and it is required the moment any
            third-party login is visible in a store build again. */}
        {!IS_STORE_BUILD && (
          <>
            <button
              onClick={handleGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-neutral-100 text-neutral-900 py-2.5 font-semibold text-sm mb-4 disabled:opacity-50 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30"
            >
              <GoogleMark /> Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-px bg-neutral-800 flex-1" />
              <span className="text-[10px] uppercase tracking-widest text-neutral-600">or</span>
              <div className="h-px bg-neutral-800 flex-1" />
            </div>
          </>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-neutral-600"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-neutral-600"
            />
          </div>

          {mode === "signup" && (
            <label className="flex items-start gap-2 text-[11px] text-neutral-500 leading-snug">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => setShowLegal(true)}
                  className="underline"
                  style={{ color: ACCENT }}
                >
                  Terms of Service and Privacy Policy
                </button>{" "}
                and understand this is coaching guidance, not legal or HR advice.
              </span>
            </label>
          )}

          {error && <p className="text-[12px] text-red-400">{error}</p>}
          {notice && <p className="text-[12px] text-emerald-400">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg py-2.5 font-semibold text-sm text-neutral-950 disabled:opacity-50 flex items-center justify-center gap-2 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ backgroundColor: ACCENT }}
          >
            {busy && <Loader2 className="animate-spin" size={16} />}
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {mode === "signin" && (
          <button
            type="button"
            onClick={() => { setMode("forgot"); setResetSent(false); resetFeedback(); }}
            className="w-full text-center text-[11px] text-neutral-500 mt-4 underline"
          >
            Forgot your password?
          </button>
        )}
          </>
        )}
      </div>
      </div>
      </div>
      {showLegal && <LegalModal onClose={() => setShowLegal(false)} />}
    </div>
  );
}
