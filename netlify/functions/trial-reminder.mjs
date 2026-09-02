import { createClient } from "@supabase/supabase-js";

// Frontline Coach — the trial-ending emails. Two of them: two days before the seven days
// run out, and once they have.
//
// WHY THIS IS THE MOST VALUABLE FUNCTION IN THE REPO RIGHT NOW
// Until 1 Sep nothing warned anybody. A user's trial ended and they found out by hitting
// a wall the next time they opened the app — and with trials now rolling, that happens
// continuously rather than on one announced date. Worse, the iOS app has no purchase path
// at all: Paywall is gated by IS_STORE_BUILD for Guideline 3.1.1, so an iPhone user who
// wants to pay currently cannot. This email is the only route they have, because the link
// lands them on the WEB app where checkout works.
//
// Apple's rules govern what is in the app, not what a developer sends to their own
// customers — settled by the Epic injunction. So this ships today with no App Store
// review, while the in-app link-out waits for a build.
//
// Required env vars (Netlify):
//   RESEND_API_KEY             - from resend.com/api-keys. THE ONLY THING BLOCKING THIS.
//                                Supabase's SMTP settings hold Resend credentials for
//                                auth emails, but a Netlify function cannot read those,
//                                so the key has to exist here too.
//   SUPABASE_SERVICE_ROLE_KEY  - already set; trial_reminder_queue() is service-role only
//   SUPABASE_URL / VITE_SUPABASE_URL
//   PUBLIC_SITE_URL            - optional, defaults to the production site
//   TRIAL_REMINDER_JOB_SECRET  - optional; lets you trigger a run by hand. Same pattern
//                                as SYNTHESIS_JOB_SECRET in synthesize-memory.mjs
//
// FROM ADDRESS: auth.frontline-coach.com is the only domain verified in Resend (checked
// 2 Sep 2026), so mail sends from there. Verify the root domain if the subdomain in the
// From line ever bothers you; deliverability is already fine, since the subdomain carries
// its own DKIM. Reply-to is support@, which is a real monitored mailbox.

const FROM = process.env.TRIAL_REMINDER_FROM || "Ben at Frontline Coach <ben@auth.frontline-coach.com>";
const REPLY_TO = "support@otsowntheshift.com";

// Plain text, deliberately. This is a one-man product emailing a shift manager about
// something practical — an HTML template with a hero image and a gradient button would
// read like marketing, and marketing is what people delete. It also cannot break in a
// mail client, which an HTML template absolutely can.
function bodyFor(kind, siteUrl) {
  if (kind === "two_days") {
    return `Your seven days on Frontline Coach run out in two days.

Nothing will be charged — you never gave us a card, so there is no renewal and no bill coming. When the trial ends the tools stop, and everything you have written stays exactly where it is.

If it earned its place, you can keep going here:
${siteUrl}

$14.99 a month, or $119 for the year. The first 100 people to subscribe keep $7.99 a month for as long as they stay subscribed — if there are spots left when you sign in, you will see that rate on the screen.

If it did not earn its place, tell me why. I read every reply and I would rather know what was missing than not.

— Ben
Own The Shift`;
  }

  return `Your seven days on Frontline Coach are up.

The tools have stopped, but nothing has been deleted and nothing has been charged. Your conversations, your history and everything the coach remembers about your people are still there. Subscribe whenever and it is all waiting.

${siteUrl}

$14.99 a month, or $119 for the year. The first 100 people to subscribe keep $7.99 a month for good — if spots remain, that rate shows up when you sign in.

And if it was not for you, that is a fair answer. A one-line reply telling me what fell short is worth more to me than a polite silence.

— Ben
Own The Shift`;
}

function subjectFor(kind) {
  return kind === "two_days"
    ? "Two days left on your Frontline Coach trial"
    : "Your Frontline Coach trial has ended";
}

async function sendEmail(apiKey, to, subject, text) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, text }),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.text()).slice(0, 300); } catch (e) { /* ignore */ }
    throw new Error(`resend ${res.status}: ${detail}`);
  }
  return res.json();
}

export default async (req) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

  // Netlify's scheduler sets this header on scheduled invocations. Anything else has to
  // present the job secret — otherwise this endpoint is a way for a stranger to make us
  // send mail. Same gate as synthesize-memory.mjs.
  const isScheduled = req.headers.get("x-netlify-event") === "schedule";
  const secret = process.env.TRIAL_REMINDER_JOB_SECRET;
  const provided = req.headers.get("x-job-secret") || new URL(req.url).searchParams.get("key");
  if (!isScheduled && !(secret && provided === secret)) {
    return json({ error: "Not authorized" }, 401);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://frontline-coach.com";

  if (!supabaseUrl || !serviceKey) return json({ error: "Server not configured" }, 500);
  if (!apiKey) {
    // Explicit rather than silent. A mail job that no-ops for a month because a key was
    // never added looks exactly like a mail job with nobody to email.
    return json({ error: "RESEND_API_KEY is not set — no mail can be sent" }, 500);
  }

  // DRY RUN: ?dry=1 returns exactly who would be emailed and sends nothing. Use it before
  // the first real run — this function's failure mode is mailing the wrong people, and
  // that cannot be taken back.
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { data: queue, error } = await admin.rpc("trial_reminder_queue");
    if (error) throw new Error(`queue failed: ${error.message}`);

    const rows = Array.isArray(queue) ? queue : [];
    if (dry) {
      return json({ dryRun: true, count: rows.length, recipients: rows }, 200);
    }

    const sent = [];
    const failed = [];

    // Sequential, not Promise.all. Resend rate-limits, the daily volume is tiny, and a
    // burst of parallel sends buys nothing except a harder failure to reason about.
    for (const row of rows) {
      try {
        await sendEmail(apiKey, row.email, subjectFor(row.kind), bodyFor(row.kind, siteUrl));
        // Mark only AFTER the provider accepted it, and one row at a time. If this loop
        // dies halfway, everybody still unmailed stays in tomorrow's queue.
        const { error: markErr } = await admin.rpc("mark_trial_reminder_sent", {
          p_user_id: row.user_id,
          p_kind: row.kind,
        });
        if (markErr) {
          // Sent but not recorded: they will be emailed again tomorrow. Log loudly,
          // because a duplicate email is the one failure a user actually notices.
          console.error(`SENT BUT NOT MARKED for ${row.user_id} (${row.kind}): ${markErr.message}`);
        }
        sent.push({ kind: row.kind });
      } catch (e) {
        failed.push({ kind: row.kind, error: String(e.message || e) });
        console.error(`trial reminder failed (${row.kind}): ${e.message || e}`);
      }
    }

    return json({ queued: rows.length, sent: sent.length, failed }, 200);
  } catch (e) {
    console.error("trial-reminder job failed:", e);
    return json({ error: String(e.message || e) }, 500);
  }
};

// Once a day at 14:00 UTC — mid-morning across the US, so a "two days left" email lands
// while somebody is at work and can act on it, rather than at 3am. An hour after
// synthesize-memory's 13:00 slot so the two jobs are not competing for the same cold
// function instance.
export const config = {
  schedule: "0 14 * * *",
};
