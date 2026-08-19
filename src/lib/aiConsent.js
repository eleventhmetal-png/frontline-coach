import { supabase } from "./supabaseClient";

// =====================================================
// THIRD-PARTY AI CONSENT — App Store Guideline 5.1.2(i)
// =====================================================
// Apple requires explicit, informed permission BEFORE user data is sent to a
// third-party AI service, naming the service. "Powered by AI" does not satisfy
// it, a pre-checked box does not satisfy it, and burying it in the privacy
// policy does not satisfy it. It also has to be revocable.
//
// WHY THE GATE LIVES HERE AND NOT ON A SCREEN: gating app entry would put a wall
// in front of an app whose actual problem is that people don't come back. This
// gates the FIRST OUTBOUND CALL instead, which is both what the guideline
// literally asks for and less hostile — Home stays browsable, and the sheet
// appears the moment something is about to leave the device.
//
// Every AI path funnels through rawClaude/streamClaude/the TTS driver, so
// awaiting requireAiConsent() at those three chokepoints covers every tool,
// including tools that don't exist yet. No per-tool wiring, nothing to forget.

// Bump this when the set of processors changes — a new vendor means the previous
// consent no longer describes what happens, so everyone is asked again.
// 2026-08-13: Anthropic (text) + OpenAI (read-aloud voice) + device dictation.
export const CONSENT_VERSION = "2026-08-13";

// Cached per page load. The gate is on a hot path and must not hit the network
// on every turn of a roleplay.
let cached = false;

export function consentFromSession(session) {
  const v = session?.user?.user_metadata?.ai_consent_version;
  return v === CONSENT_VERSION;
}

async function readConsent() {
  try {
    const { data } = (await supabase?.auth?.getSession?.()) ?? { data: null };
    return consentFromSession(data?.session);
  } catch (e) {
    return false;
  }
}

// Stored in user_metadata, matching how AuthGate records tos_accepted_at at
// signup. Deliberately NOT localStorage: this is a consent record, it should
// survive a new device and be auditable, and user_metadata needs no migration.
export async function recordConsent() {
  const at = new Date().toISOString();
  try {
    const { error } = await supabase.auth.updateUser({
      data: { ai_consent_at: at, ai_consent_version: CONSENT_VERSION },
    });
    if (error) throw error;
    cached = true;
    return true;
  } catch (e) {
    return false;
  }
}

export async function revokeConsent() {
  try {
    const { error } = await supabase.auth.updateUser({
      data: { ai_consent_at: null, ai_consent_version: null },
    });
    if (error) throw error;
    cached = false;
    return true;
  } catch (e) {
    return false;
  }
}

// The shell registers a function that shows the sheet and resolves true/false.
let asker = null;
export function setConsentAsker(fn) { asker = fn; }

export function resetConsentCache() { cached = false; }

export async function requireAiConsent() {
  if (cached) return true;
  if (await readConsent()) { cached = true; return true; }
  if (typeof asker !== "function") {
    // No UI registered (shouldn't happen in the app). Fail CLOSED — the whole
    // point is that nothing leaves the device unasked.
    const e = new Error("consent-unavailable");
    e.userMessage = "Turn on AI processing in Tools, Data and privacy, to use the coach.";
    throw e;
  }
  const ok = await asker();
  if (!ok) {
    const e = new Error("consent-declined");
    e.declined = true;
    e.userMessage = "Nothing was sent. You can turn this on any time in Tools, Data and privacy.";
    throw e;
  }
  cached = true;
  return true;
}
