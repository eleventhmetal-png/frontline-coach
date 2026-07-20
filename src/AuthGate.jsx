import React, { useState, useEffect } from "react";
import { Zap, Loader2, Mail, Lock, AlertTriangle, X } from "lucide-react";
import { supabase, supabaseReady } from "./lib/supabaseClient";
import { TERMS_SECTIONS, PRIVACY_SECTIONS, LAST_UPDATED } from "./legalContent";

const ACCENT = "#E8923C";

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

function LegalModal({ onClose }) {
  const [view, setView] = useState("terms"); // "terms" | "privacy"
  const sections = view === "terms" ? TERMS_SECTIONS : PRIVACY_SECTIONS;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
      <div className="w-full max-w-md max-h-[85vh] bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex rounded-lg border border-neutral-800 p-1">
            {[
              { id: "terms", label: "Terms" },
              { id: "privacy", label: "Privacy" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  view === v.id ? "bg-neutral-800 text-neutral-100" : "text-neutral-500"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-[11px] text-neutral-600">Last updated {LAST_UPDATED}</p>
          {sections.map((s) => (
            <div key={s.heading}>
              <div className="text-sm font-semibold text-neutral-200 mb-1">{s.heading}</div>
              {s.body.map((p, i) => (
                <p key={i} className="text-xs text-neutral-500 leading-relaxed mb-1">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Gates the app behind Supabase auth. Renders sign-in/sign-up while
 * unauthenticated, then children (the real app) once a session exists.
 * Passes { session, profile, signOut } to children via render prop so
 * downstream code (session logging, team lookups) can use them.
 */
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

  useEffect(() => {
    if (!supabaseReady) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
    if (mode === "signup" && !tosAccepted) {
      setError("You need to accept the Terms of Service to create an account.");
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
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    resetFeedback();
    setBusy(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
            <Zap size={16} className="text-neutral-950" />
          </div>
          <span className="font-extrabold uppercase tracking-tight">Frontline Coach</span>
        </div>

        <div className="flex rounded-lg border border-neutral-800 p-1 mb-6">
          {["signin", "signup"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); resetFeedback(); }}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                mode === m ? "bg-neutral-800 text-neutral-100" : "text-neutral-500"
              }`}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-neutral-100 text-neutral-900 py-2.5 font-semibold text-sm mb-4 disabled:opacity-50"
        >
          <GoogleMark /> Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px bg-neutral-800 flex-1" />
          <span className="text-[10px] uppercase tracking-widest text-neutral-600">or</span>
          <div className="h-px bg-neutral-800 flex-1" />
        </div>

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
            className="w-full rounded-lg py-2.5 font-semibold text-sm text-neutral-950 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: ACCENT }}
          >
            {busy && <Loader2 className="animate-spin" size={16} />}
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
      {showLegal && <LegalModal onClose={() => setShowLegal(false)} />}
    </div>
  );
}
