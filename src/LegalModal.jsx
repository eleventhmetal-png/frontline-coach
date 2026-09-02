import React, { useState } from "react";
import { X } from "lucide-react";
import { TERMS_SECTIONS, PRIVACY_SECTIONS, LAST_UPDATED } from "./legalContent";

// =====================================================
// LEGAL VIEWER — Terms and Privacy Policy, rendered in-app
// =====================================================
// MOVED OUT OF AuthGate.jsx 25 Aug 2026 because the app needed it too.
//
// WHY THIS EXISTS RATHER THAN LINKS TO privacy.html:
// Every legal link inside the app used to be an <a href="/privacy.html"
// target="_blank">. In a browser that opens a tab. Inside Capacitor's WKWebView
// a _blank target has nowhere to go — the anchor takes the tap, shows its active
// state, and nothing happens. Reported on device 25 Aug 2026: "they just light up
// when I click them."
//
// That is a rejection, not a cosmetic bug. Apple rejected this build under
// 5.1.1(i) partly on privacy disclosure, and 5.1.1(v) account deletion sits on
// the same card as one of those dead links. A reviewer who taps Privacy Policy
// and gets nothing files it.
//
// Dropping target="_blank" would fix the tap and replace it with a worse bug: the
// webview navigates away from the app to capacitor://localhost/privacy.html and
// there is no browser chrome to come back with.
//
// So the text renders in-app from the same legalContent.js the static pages are
// generated from — one source, no divergence, and it works with no network at all,
// which matters when a reviewer is on hotel wifi. The static pages stay for the
// web, where crawlers and direct links need a real URL.
//
// z-[60] on purpose: this opens from inside the consent sheet, which is z-50.
export default function LegalModal({ onClose, initialView = "terms" }) {
  const [view, setView] = useState(initialView); // "terms" | "privacy"
  const sections = view === "terms" ? TERMS_SECTIONS : PRIVACY_SECTIONS;
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-4">
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
          <button onClick={onClose} aria-label="Close" className="text-neutral-500 hover:text-neutral-200">
            <X size={20} />
          </button>
        </div>
        <div
          className="overflow-y-auto px-5 py-4 space-y-4"
          style={{ WebkitOverflowScrolling: "touch", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
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
