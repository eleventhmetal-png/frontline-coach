import React, { useState, useRef, useEffect } from "react";
import {
  Home, MessageSquare, Shield, FileText, ClipboardList,
  Zap, Copy, Check, Loader2, AlertTriangle, ArrowRight,
  ChevronLeft, Send, Target, Play, Award, RotateCcw, MoreHorizontal,
  Share2, Download, X
} from "lucide-react";

// ---------- Claude API helpers ----------
async function rawClaude(messages) {
  // Calls our own server function, which holds the API key. The key never touches the browser.
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, max_tokens: 1000 }),
  });
  if (!res.ok) throw new Error("Request failed");
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// single-shot, returns parsed JSON
async function callClaude(system, user) {
  const text = await rawClaude([
    { role: "user", content: `${system}\n\n---\nMANAGER INPUT:\n${user}` },
  ]);
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const slice = start >= 0 && end >= 0 ? clean.slice(start, end + 1) : clean;
  return JSON.parse(slice);
}

// multi-turn chat, returns plain text reply
async function callChat(system, history) {
  const msgs = [{ role: "user", content: system }, { role: "assistant", content: "Understood. I'm in character." }, ...history];
  return (await rawClaude(msgs)).trim();
}

// ---------- shared UI bits ----------
const ACCENT = "#E8923C";

// One voice spine injected into every AI tool. Tune here, it propagates everywhere.
const VOICE = `VOICE — follow this exactly:
You are a frontline operator who has run real shifts and held real people accountable. Not a consultant, not HR, not a life coach. You're standing next to this manager on the floor, not presenting to them.

How you write:
- Any line the manager will SAY OUT LOUD must sound spoken. Contractions. Short. The way a person actually talks on a shift, not a paragraph read off a card.
- Plain words. Shortest word that works.
- Name the behavior and the standard. Never the employee's character, motive, or feelings.
- No therapy voice. Do not validate feelings as a tactic. Never write "I understand," "I hear you," or "I know this is hard."
- Make the call. No "it depends," no "you might want to consider." Tell them what to do.
- Lead with the point. No warmup sentence.
- Vary the rhythm. Some sentences short. Punch.

Banned phrases (they read as fake): "it's important to," "make sure to," "be sure to," "navigate," "foster," "ensure," "leverage," "at the end of the day," "that being said," "circle back," "reach out," "touch base," "going forward." Never use the structure "It's not just X, it's Y." Do not lean on em dashes; a comma usually works.

The lens: extreme ownership, clarity is kindness, candor over comfort, standards over feelings. Apply it. Do not name-drop frameworks or quote anyone.`;

function CopyBtn({ getText }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getText());
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch (e) {}
      }}
      className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-100 transition-colors"
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Section({ label, children, accent }) {
  return (
    <div className="border-b border-neutral-800 last:border-0 py-4">
      <div
        className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
        style={{ color: accent ? ACCENT : "#8a8a8a" }}
      >
        {label}
      </div>
      <div className="text-[15px] leading-relaxed text-neutral-100">
        {children}
      </div>
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul className="space-y-1.5">
      {(items || []).map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span style={{ color: ACCENT }} className="mt-1.5 shrink-0">
            <span className="block w-1.5 h-1.5 rounded-full bg-current" />
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Quote({ children }) {
  return (
    <div
      className="border-l-2 pl-3 italic text-neutral-200"
      style={{ borderColor: ACCENT }}
    >
      {children}
    </div>
  );
}

function GenerateButton({ onClick, loading, label, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full flex items-center justify-center gap-2 rounded-lg py-3.5 font-bold uppercase tracking-wide text-sm text-neutral-950 transition-opacity disabled:opacity-40"
      style={{ backgroundColor: ACCENT }}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
      {loading ? "Working…" : label}
    </button>
  );
}

function ErrorNote({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-950/40 border border-red-900/50 p-3 text-sm text-red-200">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

function ResultCard({ children }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5 mt-4">
      {children}
    </div>
  );
}

// ---------- share card ----------
function wrapLines(ctx, text, maxW) {
  const words = (text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// draws the card and returns a data URL; runs twice internally (measure, then draw)
function buildShareImage(card) {
  const W = 1080;
  const PAD = 84;
  const contentW = W - PAD * 2;
  const C = { bg: "#161616", text: "#f4f4f4", accent: "#E8923C", muted: "#8b8b8b" };

  function layout(ctx, draw) {
    let y = PAD;

    // top accent bar
    if (draw) {
      ctx.fillStyle = C.accent;
      ctx.fillRect(PAD, y, 64, 8);
    }
    y += 8 + 44;

    // category
    ctx.font = "600 30px sans-serif";
    const catLines = wrapLines(ctx, (card.category || "").toUpperCase(), contentW);
    if (draw) {
      ctx.fillStyle = C.muted;
      catLines.forEach((l) => { ctx.fillText(l, PAD, y); y += 40; });
    } else y += catLines.length * 40;
    y += 24;

    // headline (hero)
    ctx.font = "800 66px sans-serif";
    const headLines = wrapLines(ctx, card.headline || "", contentW);
    if (draw) {
      ctx.fillStyle = C.text;
      headLines.forEach((l) => { ctx.fillText(l, PAD, y); y += 80; });
    } else y += headLines.length * 80;
    y += 36;

    // sections
    (card.sections || []).forEach((s) => {
      ctx.font = "700 28px sans-serif";
      if (draw) {
        ctx.fillStyle = C.accent;
        ctx.fillText((s.label || "").toUpperCase(), PAD, y);
      }
      y += 46;
      ctx.font = "400 38px sans-serif";
      const bodyLines = wrapLines(ctx, s.text || "", contentW);
      if (draw) {
        ctx.fillStyle = C.text;
        bodyLines.forEach((l) => { ctx.fillText(l, PAD, y); y += 52; });
      } else y += bodyLines.length * 52;
      y += 34;
    });

    // footer
    y += 20;
    if (draw) {
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(W - PAD, y);
      ctx.stroke();
    }
    y += 52;
    ctx.font = "800 36px sans-serif";
    if (draw) {
      ctx.fillStyle = C.accent;
      ctx.fillText("FRONTLINE COACH", PAD, y);
    }
    y += 40;
    ctx.font = "400 28px sans-serif";
    if (draw) {
      ctx.fillStyle = C.muted;
      ctx.fillText("Know what to say. Lead the shift.", PAD, y);
    }
    y += PAD;
    return y;
  }

  // pass 1: measure
  const measure = document.createElement("canvas").getContext("2d");
  const H = Math.ceil(layout(measure, false));

  // pass 2: draw at 2x for crisp output
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  layout(ctx, true);
  return canvas.toDataURL("image/png");
}

function ShareButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
      style={{ color: ACCENT }}
    >
      <Share2 size={14} /> Share
    </button>
  );
}

function ShareSheet({ card, textVersion, onClose }) {
  const [img, setImg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (card) {
      try { setImg(buildShareImage(card)); } catch (e) {}
    }
  }, [card]);

  if (!card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold uppercase tracking-tight text-neutral-100">Share card</span>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200"><X size={20} /></button>
        </div>

        <div className="rounded-xl overflow-hidden border border-neutral-800 mb-3 bg-neutral-950">
          {img
            ? <img src={img} alt="share card" className="w-full block" />
            : <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-neutral-600" /></div>}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-xs text-neutral-400 mb-3">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
          <span>Check for employee names before you send. Keep it about the situation, not the person.</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a
            href={img || undefined}
            download="frontline-coach.png"
            className="flex items-center justify-center gap-2 rounded-lg py-3 font-bold text-sm text-neutral-950"
            style={{ backgroundColor: ACCENT }}
          >
            <Download size={16} /> Save image
          </a>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(textVersion || "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              } catch (e) {}
            }}
            className="flex items-center justify-center gap-2 rounded-lg py-3 font-bold text-sm text-neutral-200 border border-neutral-700"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy text"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// FEATURE 1 — AI COACH
// =====================================================
const COACH_SITUATIONS = [
  "Employee is repeatedly late",
  "Strong employee is becoming toxic",
  "Team is not following standards",
  "Employee not improving after coaching",
  "Two employees in conflict",
  "Employee refuses an assignment",
  "Shift performance is declining",
  "Employee has potential but no confidence",
];

const COACH_SYSTEM = `${VOICE}

You are the AI Coach inside Frontline Coach. A manager describes a people problem on their shift. You diagnose it, tell them what they own, and hand them a plan they can run today. You challenge them when they're avoiding the conversation, being vague, overreacting, or blaming the team for a gap they created. You separate skill from will.

Hard rules for this output:
- "whatYouOwn" must name a SPECIFIC likely failure on the manager's side (unclear expectation never set, a standard they enforce inconsistently, a conversation they've been ducking, no follow-up after the last talk). No generic "communication could be better." If they genuinely own nothing yet, say what they'll own if they handle it wrong.
- "whatToSay" is the actual words, spoken. Not a description of what to say. Write what comes out of their mouth.
- "leadershipPrinciple" is a blunt operator line, not a poster quote.
- Never produce discriminatory, retaliatory, or humiliating tactics.

Return ONLY valid JSON, no markdown, no preamble. Every field tight. Scripts 2-4 sentences. Lists 3-5 short items. Schema:
{
 "whatMayBeHappening": "the real read on the situation",
 "whatYouOwn": "the specific thing the manager set up or let slide",
 "theStandard": "what good looks like, stated flat",
 "beforeYouTalk": "what to verify or pull before the conversation",
 "questionsToAsk": ["3-5 open questions that don't lead the witness"],
 "whatToSay": "the spoken opening, in their voice",
 "watchFor": ["3-4 signals to read in the moment"],
 "nextSteps": ["actions with an owner and a deadline"],
 "documentThis": "one factual paragraph, no emotion, no motive",
 "followUp": "exact timing and what you're checking for",
 "leadershipPrinciple": "one blunt line"
}`;

function AICoach() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [share, setShare] = useState(null);

  async function run() {
    if (!input.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const r = await callClaude(COACH_SYSTEM, input);
      setResult(r);
    } catch (e) {
      setError("Couldn't generate a plan. Add a bit more detail and try again.");
    } finally {
      setLoading(false);
    }
  }

  const copyAll = () => result ? [
    `WHAT MAY BE HAPPENING\n${result.whatMayBeHappening}`,
    `WHAT YOU OWN\n${result.whatYouOwn}`,
    `THE STANDARD\n${result.theStandard}`,
    `BEFORE YOU TALK\n${result.beforeYouTalk}`,
    `QUESTIONS TO ASK\n- ${(result.questionsToAsk||[]).join("\n- ")}`,
    `WHAT TO SAY\n${result.whatToSay}`,
    `WATCH FOR\n- ${(result.watchFor||[]).join("\n- ")}`,
    `NEXT STEPS\n- ${(result.nextSteps||[]).join("\n- ")}`,
    `DOCUMENT THIS\n${result.documentThis}`,
    `FOLLOW-UP\n${result.followUp}`,
    `PRINCIPLE: ${result.leadershipPrinciple}`,
  ].join("\n\n") : "";

  return (
    <div>
      <ToolHeader
        title="AI Coach"
        sub="Describe the situation. Get a plan you can run on this shift."
      />
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        placeholder="e.g. My best closer has started snapping at new hires and rolling his eyes in pre-shift. Other staff are pulling back from him."
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 p-3.5 text-[15px] text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
      />
      <div className="flex flex-wrap gap-2 my-3">
        {COACH_SITUATIONS.map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            className="text-xs rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-neutral-400 hover:text-neutral-100 hover:border-neutral-600 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
      <GenerateButton onClick={run} loading={loading} label="Coach me through it" />
      <ErrorNote msg={error} />

      {result && (
        <ResultCard>
          <div className="flex justify-end gap-4 mb-1">
            <ShareButton onClick={() => setShare({
              category: "Leadership move",
              headline: result.leadershipPrinciple,
              sections: [
                { label: "The standard", text: result.theStandard },
                { label: "What to say", text: result.whatToSay },
              ],
            })} />
            <CopyBtn getText={copyAll} />
          </div>
          <Section label="What may be happening">{result.whatMayBeHappening}</Section>
          <Section label="What you own" accent>{result.whatYouOwn}</Section>
          <Section label="The standard">{result.theStandard}</Section>
          <Section label="Before you talk">{result.beforeYouTalk}</Section>
          <Section label="Questions to ask"><BulletList items={result.questionsToAsk} /></Section>
          <Section label="What to say" accent><Quote>{result.whatToSay}</Quote></Section>
          <Section label="Watch for"><BulletList items={result.watchFor} /></Section>
          <Section label="Agree on next steps"><BulletList items={result.nextSteps} /></Section>
          <Section label="Document this">{result.documentThis}</Section>
          <Section label="Follow-up">{result.followUp}</Section>
          <div className="pt-4">
            <div
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-neutral-950"
              style={{ backgroundColor: ACCENT }}
            >
              {result.leadershipPrinciple}
            </div>
          </div>
        </ResultCard>
      )}
      <ShareSheet card={share} textVersion={copyAll()} onClose={() => setShare(null)} />
    </div>
  );
}

// =====================================================
// FEATURE 2 — PUSHBACK COACH
// =====================================================
const PUSHBACK_COMMON = [
  "That's not my job",
  "Nobody else does it",
  "You're targeting me",
  "I was never trained",
  "I'm doing my best",
  "The other shift left it like this",
  "That rule makes no sense",
  "I'm not signing that",
];
const TONES = ["Calm", "Firm", "Coaching", "Formal", "Supportive", "Direct"];

const PUSHBACK_SYSTEM = `${VOICE}

A manager just got pushback from an employee, live, and needs the words right now. Give them a response that holds the standard without escalating and without groveling. The "immediateResponse" is the whole game — it has to be something a real manager would actually say standing there, not a scripted HR line.

Match the requested TONE and make it actually change the words:
- Calm: steady, low heat, no edge.
- Firm: clear line, no apology, not angry.
- Coaching: turn it into a question, get them thinking.
- Formal: by the book, documentation-ready wording.
- Supportive: acknowledge the load, hold the standard anyway.
- Direct: shortest version, no cushion.

Return ONLY valid JSON, no markdown. Each field 1-2 sentences, spoken. Schema:
{
 "immediateResponse": "the exact words to say back, in the chosen tone",
 "followUpQuestion": "one question that opens it up instead of shutting it down",
 "standardRestatement": "restate the expectation flat",
 "boundaryStatement": "the line, calm and clear",
 "escalationOption": "what to do if it keeps happening",
 "documentationNote": "one factual line for the file"
}`;

function PushbackCoach() {
  const [input, setInput] = useState("");
  const [tone, setTone] = useState("Firm");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [share, setShare] = useState(null);

  const copyAll = () => result ? [
    `WHEN THEY SAY: "${input}"`,
    `SAY THIS: ${result.immediateResponse}`,
    `THEN ASK: ${result.followUpQuestion}`,
    `STANDARD: ${result.standardRestatement}`,
    `BOUNDARY: ${result.boundaryStatement}`,
    `IF IT CONTINUES: ${result.escalationOption}`,
  ].join("\n\n") : "";

  async function run() {
    if (!input.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const r = await callClaude(PUSHBACK_SYSTEM, `TONE: ${tone}\nEMPLOYEE SAID: "${input}"`);
      setResult(r);
    } catch (e) {
      setError("Couldn't generate a response. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <ToolHeader
        title="What do I say when they say…?"
        sub="Paste the pushback. Get a response that holds the line."
      />
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={`e.g. "That's not my job"`}
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 p-3.5 text-[15px] text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
      />
      <div className="flex flex-wrap gap-2 my-3">
        {PUSHBACK_COMMON.map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            className="text-xs rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-neutral-400 hover:text-neutral-100 hover:border-neutral-600 transition-colors"
          >
            "{s}"
          </button>
        ))}
      </div>
      <div className="mb-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 mb-2">Tone</div>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className="text-sm rounded-lg px-3.5 py-1.5 font-medium transition-colors border"
              style={
                tone === t
                  ? { backgroundColor: ACCENT, color: "#0a0a0a", borderColor: ACCENT }
                  : {}
              }
            >
              <span className={tone === t ? "" : "text-neutral-400"}>{t}</span>
            </button>
          ))}
        </div>
      </div>
      <GenerateButton onClick={run} loading={loading} label="Give me the words" />
      <ErrorNote msg={error} />

      {result && (
        <ResultCard>
          <div className="flex justify-end gap-4 mb-1">
            <ShareButton onClick={() => setShare({
              category: `When they say "${input}"`,
              headline: result.immediateResponse,
              sections: [
                { label: "Hold the line", text: result.boundaryStatement },
              ],
            })} />
            <CopyBtn getText={copyAll} />
          </div>
          <Section label="Say this now" accent><Quote>{result.immediateResponse}</Quote></Section>
          <Section label="Then ask">{result.followUpQuestion}</Section>
          <Section label="Restate the standard">{result.standardRestatement}</Section>
          <Section label="Hold the boundary">{result.boundaryStatement}</Section>
          <Section label="If it continues">{result.escalationOption}</Section>
          <Section label="Note for the file">{result.documentationNote}</Section>
        </ResultCard>
      )}
      <ShareSheet card={share} textVersion={copyAll()} onClose={() => setShare(null)} />
    </div>
  );
}

// =====================================================
// FEATURE 3 — DOCUMENTATION ASSISTANT
// =====================================================
const DOC_SYSTEM = `You are Frontline Coach's documentation assistant. Turn the manager's rough notes into a clean, factual performance record. REMOVE insults, emotionally loaded language, assumptions, unverifiable motives, diagnoses, exaggeration, and any retaliatory or discriminatory language. State only observable behavior and facts. Never state or imply whether someone should be terminated.

Return ONLY valid JSON, no markdown. Schema:
{
 "dateTime": "use what's given or write 'To be confirmed'",
 "observedBehavior": "factual, observable only",
 "standard": "the expectation that applies",
 "priorCommunication": "prior conversations if mentioned, else 'None noted'",
 "employeeResponse": "what the employee said/did, factual",
 "managerResponse": "what the manager did",
 "agreedAction": "what was agreed",
 "followUpDate": "suggested follow-up",
 "cleanedNote": "a single tight paragraph combining the above into a record ready to file"
}`;

function DocAssistant() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function run() {
    if (!input.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const r = await callClaude(DOC_SYSTEM, input);
      setResult(r);
    } catch (e) {
      setError("Couldn't clean that up. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <ToolHeader
        title="Documentation Assistant"
        sub="Dump your rough notes. Get a factual record, emotion stripped out."
      />
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={5}
        placeholder="e.g. Jake showed up 25 min late again, third time this week, didn't even care, just shrugged. I'm so done with his attitude. Told him this is the last straw."
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 p-3.5 text-[15px] text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
      />
      <div className="my-3 flex items-start gap-2 rounded-lg bg-neutral-900 border border-neutral-800 p-3 text-xs text-neutral-400">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
        <span>Supports documentation quality. Does not replace company policy, HR guidance, or legal advice, and does not make employment decisions.</span>
      </div>
      <GenerateButton onClick={run} loading={loading} label="Clean it up" />
      <ErrorNote msg={error} />

      {result && (
        <ResultCard>
          <div className="flex justify-end mb-1">
            <CopyBtn getText={() => result.cleanedNote} />
          </div>
          <Section label="Date / time">{result.dateTime}</Section>
          <Section label="Observed behavior">{result.observedBehavior}</Section>
          <Section label="Standard">{result.standard}</Section>
          <Section label="Prior communication">{result.priorCommunication}</Section>
          <Section label="Employee response">{result.employeeResponse}</Section>
          <Section label="Manager response">{result.managerResponse}</Section>
          <Section label="Agreed action">{result.agreedAction}</Section>
          <Section label="Follow-up">{result.followUpDate}</Section>
          <Section label="Ready to file" accent>
            <div className="rounded-lg bg-neutral-950 border border-neutral-800 p-3 text-neutral-200">
              {result.cleanedNote}
            </div>
          </Section>
        </ResultCard>
      )}
    </div>
  );
}

// =====================================================
// FEATURE 4 — CONVERSATION BUILDER
// =====================================================
const CONVO_TYPES = ["Coaching", "Corrective", "Attendance", "Attitude", "Recognition", "Resetting expectations", "Final warning prep", "Trust repair"];

const CONVO_SYSTEM = `${VOICE}

You build a manager a plan for a real conversation. Every script line is spoken, in their voice. Keep it to a few sentences each.

Return ONLY valid JSON, no markdown. Schema:
{
 "opening": "how to open",
 "mainMessage": "the core message, direct",
 "questions": ["2-3 questions"],
 "expectedResponse": "how they may react",
 "likelyPushback": "the most likely pushback",
 "suggestedReply": "how to answer that pushback",
 "agreement": "the agreement language to land on",
 "closing": "how to close",
 "followUpPlan": "when and what to check",
 "documentationNote": "one-line factual note"
}`;

function ConvoBuilder() {
  const [type, setType] = useState("Coaching");
  const [name, setName] = useState("");
  const [situation, setSituation] = useState("");
  const [outcome, setOutcome] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function run() {
    if (!situation.trim()) return;
    setLoading(true); setError(""); setResult(null);
    const user = `TYPE: ${type}\nEMPLOYEE: ${name || "the employee"}\nSITUATION: ${situation}\nDESIRED OUTCOME: ${outcome || "clear agreement and follow-up"}`;
    try {
      const r = await callClaude(CONVO_SYSTEM, user);
      setResult(r);
    } catch (e) {
      setError("Couldn't build the plan. Add detail and try again.");
    } finally {
      setLoading(false);
    }
  }

  const copyAll = () => result ? [
    `OPEN\n${result.opening}`,
    `MESSAGE\n${result.mainMessage}`,
    `ASK\n- ${(result.questions||[]).join("\n- ")}`,
    `LIKELY PUSHBACK\n${result.likelyPushback}`,
    `YOUR REPLY\n${result.suggestedReply}`,
    `LAND ON\n${result.agreement}`,
    `CLOSE\n${result.closing}`,
    `FOLLOW-UP\n${result.followUpPlan}`,
  ].join("\n\n") : "";

  return (
    <div>
      <ToolHeader
        title="Conversation Builder"
        sub="Walk in with a plan instead of winging it."
      />
      <div className="mb-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 mb-2">Type</div>
        <div className="flex flex-wrap gap-2">
          {CONVO_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="text-sm rounded-lg px-3 py-1.5 font-medium transition-colors border border-neutral-800"
              style={type === t ? { backgroundColor: ACCENT, color: "#0a0a0a", borderColor: ACCENT } : {}}
            >
              <span className={type === t ? "" : "text-neutral-400"}>{t}</span>
            </button>
          ))}
        </div>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Employee name (optional)"
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 p-3.5 text-[15px] text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 mb-3"
      />
      <textarea
        value={situation}
        onChange={(e) => setSituation(e.target.value)}
        rows={3}
        placeholder="What's the situation? The facts."
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 p-3.5 text-[15px] text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none mb-3"
      />
      <input
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        placeholder="What outcome do you want? (optional)"
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 p-3.5 text-[15px] text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 mb-3"
      />
      <GenerateButton onClick={run} loading={loading} label="Build the conversation" />
      <ErrorNote msg={error} />

      {result && (
        <ResultCard>
          <div className="flex justify-end mb-1">
            <CopyBtn getText={copyAll} />
          </div>
          <Section label="Open" accent><Quote>{result.opening}</Quote></Section>
          <Section label="Main message">{result.mainMessage}</Section>
          <Section label="Ask"><BulletList items={result.questions} /></Section>
          <Section label="Expect">{result.expectedResponse}</Section>
          <Section label="Likely pushback">{result.likelyPushback}</Section>
          <Section label="Your reply" accent><Quote>{result.suggestedReply}</Quote></Section>
          <Section label="Land on">{result.agreement}</Section>
          <Section label="Close">{result.closing}</Section>
          <Section label="Follow-up">{result.followUpPlan}</Section>
        </ResultCard>
      )}
    </div>
  );
}

// =====================================================
// FEATURE 5 — SKILL VS WILL DIAGNOSTIC
// =====================================================
const DIAG_QUESTIONS = [
  { key: "knowsStandard", q: "Do they know the standard?", opts: ["Yes", "Unsure", "No"] },
  { key: "canExplain", q: "Can they explain the correct process?", opts: ["Yes", "No"] },
  { key: "doneBefore", q: "Have they done it right before?", opts: ["Yes", "No"] },
  { key: "hasTools", q: "Do they have the tools and time?", opts: ["Yes", "No"] },
  { key: "followedUp", q: "Have you followed up consistently?", opts: ["Yes", "No"] },
  { key: "pattern", q: "Isolated or repeated?", opts: ["Isolated", "Repeated"] },
  { key: "whenPresent", q: "What happens when you're on the floor?", opts: ["Improves", "No change"] },
  { key: "committed", q: "Have they committed to improving?", opts: ["Yes", "No"] },
  { key: "consequences", q: "Are the consequences clear to them?", opts: ["Yes", "No"] },
];

const DIAG_SYSTEM = `${VOICE}

You diagnose whether a performance issue is primarily Skill, Will, Clarity, Capacity, Confidence, Accountability, Process failure, or Leadership failure. Land on "Leadership failure" or "Clarity" when the answers point there. Do not default to blaming the employee.

Return ONLY valid JSON, no markdown. Keep fields tight. Schema:
{
 "rootCause": "one of: Skill / Will / Clarity / Capacity / Confidence / Accountability / Process / Leadership",
 "confidence": "High / Medium / Low",
 "why": "2-3 sentences tying the answers to the cause",
 "leadershipResponse": "what the manager should do",
 "coachingQuestions": ["2-3 questions"],
 "trainingAction": "if relevant, else 'Not the issue'",
 "accountabilityAction": "the accountability move",
 "followUpInterval": "when to check"
}`;

function SkillWill() {
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const answered = Object.keys(answers).length;
  const ready = answered === DIAG_QUESTIONS.length;

  async function run() {
    setLoading(true); setError(""); setResult(null);
    const summary = DIAG_QUESTIONS.map((d) => `${d.q} ${answers[d.key]}`).join("\n");
    try {
      const r = await callClaude(DIAG_SYSTEM, `${summary}\nNotes: ${notes || "none"}`);
      setResult(r);
    } catch (e) {
      setError("Couldn't run the diagnostic. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <ToolHeader title="Skill vs. Will" sub="Answer 9 questions. Find out if it's a skill problem, a will problem — or yours." />
      <div className="space-y-3">
        {DIAG_QUESTIONS.map((d, i) => (
          <div key={d.key} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3.5">
            <div className="text-sm font-medium text-neutral-200 mb-2">
              <span style={{ color: ACCENT }} className="font-bold mr-1.5">{i + 1}.</span>{d.q}
            </div>
            <div className="flex flex-wrap gap-2">
              {d.opts.map((o) => {
                const active = answers[d.key] === o;
                return (
                  <button
                    key={o}
                    onClick={() => setAnswers((a) => ({ ...a, [d.key]: o }))}
                    className="text-sm rounded-lg px-3 py-1.5 font-medium border border-neutral-700 transition-colors"
                    style={active ? { backgroundColor: ACCENT, color: "#0a0a0a", borderColor: ACCENT } : {}}
                  >
                    <span className={active ? "" : "text-neutral-400"}>{o}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Anything else worth knowing? (optional)"
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 p-3.5 text-[15px] text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none my-3"
      />
      <GenerateButton onClick={run} loading={loading} label={ready ? "Diagnose it" : `Answer all 9 (${answered}/9)`} disabled={!ready} />
      <ErrorNote msg={error} />

      {result && (
        <ResultCard>
          <div className="text-center pb-3 border-b border-neutral-800">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Root cause</div>
            <div className="text-3xl font-extrabold uppercase tracking-tight mt-1" style={{ color: ACCENT }}>{result.rootCause}</div>
            <div className="text-xs text-neutral-500 mt-1">Confidence: {result.confidence}</div>
          </div>
          <Section label="Why">{result.why}</Section>
          <Section label="Leadership response" accent>{result.leadershipResponse}</Section>
          <Section label="Coaching questions"><BulletList items={result.coachingQuestions} /></Section>
          <Section label="Training action">{result.trainingAction}</Section>
          <Section label="Accountability action">{result.accountabilityAction}</Section>
          <Section label="Follow-up">{result.followUpInterval}</Section>
        </ResultCard>
      )}
    </div>
  );
}

// =====================================================
// FEATURE 6 — AI ROLEPLAY
// =====================================================
const RP_SCENARIOS = [
  "Defensive employee",
  "High performer, poor attitude",
  "Repeated attendance issue",
  "Underperforming new hire",
  "Employee who blames others",
  "Employee asking for promotion",
  "Employee upset about feedback",
  "Employee threatening to quit",
];
const RP_DIFFICULTY = ["Easy", "Realistic", "Hard"];

function rpSystem(scenario, difficulty) {
  return `You are playing an EMPLOYEE in a roleplay so a frontline manager can practice a hard conversation. Scenario: "${scenario}". Difficulty: ${difficulty}.

Talk like a real hourly employee getting pulled aside, not like an AI. That means:
- Short. Real speech. Half-sentences, "I mean," "look," "whatever," trailing off. 1-3 sentences max per turn.
- You're a person with a side to the story, not a problem to be solved.
- React to what the manager ACTUALLY says. If they're vague, you don't know what they want and you say so. If they come in hot or accusatory, you get defensive or shut down. If they're clear, fair, and specific, you give a little ground over a few turns, but slowly. Don't fold on turn one.
- Don't be articulate about your own feelings. People aren't.

Never break character. Never coach the manager. Never explain what they did right or wrong. You are only the employee.

${difficulty === "Hard"
    ? "Make them earn it. Excuses, deflection, 'that's not fair,' bring up other people who do worse. Don't give ground unless they're genuinely sharp."
    : difficulty === "Easy"
    ? "Guarded for a second, then reasonable. You want to do better, you just got caught off guard."
    : "Realistically guarded. Some pushback, some openness. Normal person having a normal hard conversation."}

Open the scene with one believable line as the employee reacting to being pulled aside. Don't narrate. Just talk.`;
}

const RP_SCORE_SYSTEM = `${VOICE}

You just watched a manager practice a hard conversation against a roleplay employee. Debrief them like a DM who was standing in the room. Blunt and useful. Score the manager, not the employee. If they buried the point, talked too much, asked questions then answered them, never set a clear standard, or got pulled into arguing, say it plainly. If they nailed something, say that too, specifically.

Return ONLY valid JSON, no markdown. Each field one or two tight sentences. Schema:
{
 "overall": "the honest read on how it went",
 "clarity": "did the actual point land",
 "tone": "did the tone help or get in the way",
 "questions": "did they ask or did they lecture",
 "accountability": "did they land a clear standard and next step",
 "missedOpportunity": "the single biggest thing they missed",
 "doThisNextTime": "one specific change"
}`;

function Roleplay() {
  const [scenario, setScenario] = useState(RP_SCENARIOS[0]);
  const [difficulty, setDifficulty] = useState("Realistic");
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState([]); // {role:'assistant'(employee)|'user'(manager), content}
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(null);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const sys = rpSystem(scenario, difficulty);

  function scrollDown() {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function start() {
    setLoading(true); setError(""); setScore(null);
    try {
      const opener = await callChat(sys, [{ role: "user", content: "Begin the scene. Give your first line as the employee." }]);
      setHistory([{ role: "assistant", content: opener }]);
      setStarted(true);
      scrollDown();
    } catch (e) {
      setError("Couldn't start the roleplay. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!draft.trim()) return;
    const next = [...history, { role: "user", content: draft.trim() }];
    setHistory(next); setDraft(""); setLoading(true); scrollDown();
    try {
      const reply = await callChat(sys, next);
      setHistory([...next, { role: "assistant", content: reply }]);
      scrollDown();
    } catch (e) {
      setError("No reply came back. Try sending again.");
    } finally {
      setLoading(false);
    }
  }

  async function endAndScore() {
    setLoading(true); setError("");
    const transcript = history.map((m) => `${m.role === "user" ? "MANAGER" : "EMPLOYEE"}: ${m.content}`).join("\n");
    try {
      const r = await callClaude(RP_SCORE_SYSTEM, `Scenario: ${scenario}\n\n${transcript}`);
      setScore(r);
      scrollDown();
    } catch (e) {
      setError("Couldn't score it. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStarted(false); setHistory([]); setScore(null); setDraft(""); setError("");
  }

  if (!started) {
    return (
      <div>
        <ToolHeader title="Practice" sub="Run the hard conversation against an AI employee before you run it for real." />
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 mb-2">Scenario</div>
          <div className="flex flex-wrap gap-2">
            {RP_SCENARIOS.map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className="text-sm rounded-lg px-3 py-1.5 font-medium border border-neutral-800 transition-colors"
                style={scenario === s ? { backgroundColor: ACCENT, color: "#0a0a0a", borderColor: ACCENT } : {}}
              >
                <span className={scenario === s ? "" : "text-neutral-400"}>{s}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mb-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 mb-2">Difficulty</div>
          <div className="flex gap-2">
            {RP_DIFFICULTY.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className="flex-1 text-sm rounded-lg px-3 py-2 font-medium border border-neutral-800 transition-colors"
                style={difficulty === d ? { backgroundColor: ACCENT, color: "#0a0a0a", borderColor: ACCENT } : {}}
              >
                <span className={difficulty === d ? "" : "text-neutral-400"}>{d}</span>
              </button>
            ))}
          </div>
        </div>
        <GenerateButton onClick={start} loading={loading} label="Start the roleplay" />
        <ErrorNote msg={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-bold text-neutral-100">{scenario}</div>
          <div className="text-xs text-neutral-500">{difficulty} · employee is AI</div>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100">
          <RotateCcw size={14} /> New
        </button>
      </div>

      <div className="space-y-3 mb-3">
        {history.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className="max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug"
              style={m.role === "user"
                ? { backgroundColor: ACCENT, color: "#0a0a0a", borderBottomRightRadius: 4 }
                : { backgroundColor: "#1c1c1c", color: "#e8e8e8", borderBottomLeftRadius: 4 }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && !score && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 bg-neutral-800">
              <Loader2 size={16} className="animate-spin text-neutral-400" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {score && (
        <ResultCard>
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
            <Award size={18} style={{ color: ACCENT }} />
            <span className="font-bold uppercase tracking-tight text-neutral-100">Debrief</span>
          </div>
          <Section label="Overall" accent>{score.overall}</Section>
          <Section label="Clarity">{score.clarity}</Section>
          <Section label="Tone">{score.tone}</Section>
          <Section label="Questions">{score.questions}</Section>
          <Section label="Accountability">{score.accountability}</Section>
          <Section label="Biggest miss" accent>{score.missedOpportunity}</Section>
          <Section label="Do this next time">{score.doThisNextTime}</Section>
        </ResultCard>
      )}

      {!score && (
        <div className="sticky bottom-0 bg-neutral-950 pt-2">
          <div className="flex gap-2 mb-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Your response…"
              className="flex-1 rounded-lg bg-neutral-900 border border-neutral-800 p-3 text-[15px] text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
            />
            <button
              onClick={send}
              disabled={loading || !draft.trim()}
              className="rounded-lg px-4 flex items-center justify-center text-neutral-950 disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
            >
              <Send size={18} />
            </button>
          </div>
          {history.length >= 3 && (
            <button
              onClick={endAndScore}
              disabled={loading}
              className="w-full text-sm font-semibold text-neutral-300 border border-neutral-700 rounded-lg py-2.5 hover:bg-neutral-900 disabled:opacity-40"
            >
              End &amp; score this conversation
            </button>
          )}
        </div>
      )}
      <ErrorNote msg={error} />
    </div>
  );
}

// =====================================================
// MORE — tools menu
// =====================================================
function MoreView({ go }) {
  const tools = [
    { id: "document", label: "Documentation Assistant", desc: "Rough notes to a factual record", icon: FileText },
    { id: "convo", label: "Conversation Builder", desc: "Plan a real conversation start to finish", icon: ClipboardList },
    { id: "diagnose", label: "Skill vs. Will Diagnostic", desc: "Find the real root cause", icon: Target },
  ];
  return (
    <div>
      <ToolHeader title="Tools" sub="The rest of the kit." />
      <div className="space-y-3">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            className="w-full flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left hover:border-neutral-600 transition-colors"
          >
            <t.icon size={22} style={{ color: ACCENT }} />
            <div>
              <div className="font-semibold text-neutral-100">{t.label}</div>
              <div className="text-xs text-neutral-500">{t.desc}</div>
            </div>
            <ArrowRight size={18} className="ml-auto text-neutral-600" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- shared tool header ----------
function ToolHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-extrabold uppercase tracking-tight text-neutral-50">{title}</h2>
      <p className="text-sm text-neutral-400 mt-1">{sub}</p>
    </div>
  );
}

// =====================================================
// HOME
// =====================================================
function HomeView({ go }) {
  const quick = [
    { id: "pushback", label: "Handle pushback", icon: Shield },
    { id: "practice", label: "Practice a conversation", icon: Play },
    { id: "diagnose", label: "Diagnose skill vs. will", icon: Target },
    { id: "document", label: "Document an issue", icon: FileText },
    { id: "convo", label: "Prepare a conversation", icon: ClipboardList },
  ];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
          Today's Leadership Brief
        </div>
        <div className="text-xl font-bold text-neutral-50 mt-1">{today}</div>
      </div>

      <button
        onClick={() => go("coach")}
        className="w-full flex items-center justify-between rounded-xl p-5 mb-4 text-left text-neutral-950"
        style={{ backgroundColor: ACCENT }}
      >
        <div>
          <div className="text-lg font-extrabold uppercase tracking-tight">Coach me through a situation</div>
          <div className="text-sm font-medium opacity-80">Messy situation in, clear plan out.</div>
        </div>
        <ArrowRight size={24} />
      </button>

      <div className="grid grid-cols-1 gap-3">
        {quick.map((q) => (
          <button
            key={q.id}
            onClick={() => go(q.id)}
            className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left hover:border-neutral-600 transition-colors"
          >
            <q.icon size={20} style={{ color: ACCENT }} />
            <span className="font-semibold text-neutral-100">{q.label}</span>
            <ArrowRight size={18} className="ml-auto text-neutral-600" />
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 mb-2">Suggested focus</div>
        <p className="text-[15px] text-neutral-200 leading-relaxed">
          Inspect what you expect. Pick one standard you set this week and verify it got followed — in person, on the floor, today.
        </p>
      </div>
    </div>
  );
}

// =====================================================
// APP SHELL
// =====================================================
const NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "coach", label: "Coach", icon: MessageSquare },
  { id: "pushback", label: "Pushback", icon: Shield },
  { id: "practice", label: "Practice", icon: Play },
  { id: "more", label: "More", icon: MoreHorizontal },
];

export default function FrontlineCoach() {
  const [tab, setTab] = useState("home");
  const scrollRef = useRef(null);

  const go = (id) => {
    setTab(id);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex justify-center">
      <div className="w-full max-w-md flex flex-col h-screen">
        {/* top bar */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          {tab !== "home" ? (
            <button onClick={() => go("home")} className="flex items-center gap-1 text-neutral-400 hover:text-neutral-100 text-sm">
              <ChevronLeft size={18} /> Home
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
                <Zap size={16} className="text-neutral-950" />
              </div>
              <span className="font-extrabold uppercase tracking-tight">Frontline Coach</span>
            </div>
          )}
          <span className="text-[10px] uppercase tracking-widest text-neutral-600">Beta</span>
        </header>

        {/* body */}
        <main ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
          {tab === "home" && <HomeView go={go} />}
          {tab === "coach" && <AICoach />}
          {tab === "pushback" && <PushbackCoach />}
          {tab === "practice" && <Roleplay />}
          {tab === "diagnose" && <SkillWill />}
          {tab === "document" && <DocAssistant />}
          {tab === "convo" && <ConvoBuilder />}
          {tab === "more" && <MoreView go={go} />}
        </main>

        {/* bottom nav */}
        <nav className="grid grid-cols-5 border-t border-neutral-800 shrink-0 bg-neutral-950">
          {NAV.map((n) => {
            const active = tab === n.id || (n.id === "more" && ["diagnose", "document", "convo"].includes(tab));
            return (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className="flex flex-col items-center gap-1 py-2.5"
              >
                <n.icon size={20} style={{ color: active ? ACCENT : "#6b6b6b" }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: active ? ACCENT : "#6b6b6b" }}
                >
                  {n.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
