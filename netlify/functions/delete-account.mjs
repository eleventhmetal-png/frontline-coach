import { corsPreflight, withCors } from "./_cors.mjs";
import { createClient } from "@supabase/supabase-js";

// =====================================================
// DELETE ACCOUNT — App Store Guideline 5.1.1(v)
// =====================================================
// Any app that lets a user create an account must let them delete it from
// inside the app. Not "email us", not "deactivate" — actually delete.
//
// WHY ONE CALL DOES THE WHOLE JOB: the schema was built for this. profiles.id
// references auth.users(id) ON DELETE CASCADE, and sessions, memory and
// team_members all cascade from profiles, while followups_done and usage_daily
// cascade straight from auth.users. So deleting the auth user removes every row
// of coaching content this person ever created, in one transaction, with no
// hand-maintained list of tables to forget to update when a table is added.
//
// THE ONE EXCEPTION, ON PURPOSE: reports.user_id is ON DELETE SET NULL, so abuse
// and quality reports survive with the reporter anonymised. That is the right
// call — safety records that vanish when the reporter deletes their account are
// worthless — and the Privacy Policy already reserves "limited copies needed for
// operations". The UI says so plainly rather than implying a totality it doesn't
// deliver.
//
// SECURITY: the user id comes from the VERIFIED JWT, never from the request
// body. A body-supplied id would make this an endpoint for deleting other
// people's accounts.

const SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY";

const handler = async (req) => {
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env[SERVICE_ROLE_ENV];
  if (!supabaseUrl || !anonKey) return json({ error: "Server auth not configured" }, 500);
  if (!serviceKey) return json({ error: "Server is missing " + SERVICE_ROLE_ENV }, 500);

  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) return json({ error: "Sign in required" }, 401);

  let userId = null;
  try {
    const supa = createClient(supabaseUrl, anonKey);
    const { data, error } = await supa.auth.getUser(token); // verifies the JWT
    if (error || !data?.user) return json({ error: "Invalid or expired session" }, 401);
    userId = data.user.id;
  } catch (e) {
    return json({ error: "Auth check failed" }, 401);
  }

  // Require the caller to say what they're doing. Cheap guard against a stray
  // POST from a bad link or a misfiring client deleting somebody's account.
  let payload = null;
  try {
    payload = await req.json();
  } catch (e) {
    return json({ error: "Malformed request body" }, 400);
  }
  if (payload?.confirm !== "DELETE") {
    return json({ error: "Missing confirmation" }, 400);
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("delete-account failed for", userId, error.message);
      return json({ error: "Could not delete the account" }, 500);
    }
    // Logged without any content, only the id, so there is a record that a
    // deletion happened without keeping what was deleted.
    console.log("account deleted:", userId);
    return json({ ok: true }, 200);
  } catch (e) {
    console.error("delete-account threw:", e);
    return json({ error: "Could not delete the account" }, 500);
  }
};

// CORS wrapper. Every response path — including the streaming one — goes through
// withCors, so nothing can return uncovered. See ./_cors.mjs for why this exists.
export default async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  return withCors(req, await handler(req));
};
