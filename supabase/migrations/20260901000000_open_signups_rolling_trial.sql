-- Frontline Coach — open signups for the App Store, and make the trial rolling.
--
-- WHY NOW: the iOS app was approved 25 Aug 2026 (build 1.0 (6)) and is about to be
-- released. Every guard below was written for a private pilot Ben invited by hand.
-- Against a public App Store listing they behave very differently:
--
--   1. beta_cap = 30 → the 31st stranger who downloads the app taps Sign Up and gets
--      a raw exception. That is a one-star review, and if an App Review tester tries
--      to register on a future version update it is a Guideline 2.1 rejection.
--
--   2. beta_close_date as a SIGNUP BLOCKER → after 15 Nov 2026 nobody can create an
--      account at all, while the listing stays live and downloadable. Worse than the
--      cap, because it fails 100% of new users with no way to fix it from the client.
--
--   3. trial_ends_at = least(beta_close_date, now() + 7 days) → every account created
--      between now and 15 Nov expires on the SAME DAY. The entire iOS user base would
--      hit the paywall simultaneously, and in the store build that paywall currently
--      says "there's nothing to buy here" (Paywall is gated by IS_STORE_BUILD — see
--      the 25 Aug submission notes). One cliff, no purchase path, everybody at once.
--
-- WHAT CHANGES
--   beta_cap             30 → 250. Raised, NOT removed: the free tier spends real
--                        money on AI per user, and activation is the actual problem
--                        (0 second-day returns as of 12 Aug). 250 is headroom for
--                        organic store traffic, not a growth target. Revisit with
--                        unit economics, not vibes.
--   beta_close_date      no longer blocks signup. Kept as a named constant and still
--                        reported by beta_status() so the concept survives for
--                        pricing, but a closed date must never again mean "this app
--                        cannot be used by anyone who finds it."
--   trial_ends_at        now() + 7 days, full stop. A real rolling trial per user.
--   domain block         UNCHANGED and still first.
--
-- RULE THIS MIGRATION OBEYS (from 20260812000000): `create or replace` REPLACES THE
-- WHOLE BODY. Every guard is copied forward here, and the domain check stays FIRST so
-- a blocked signup reports its own reason instead of being mistaken for "beta full".
-- The @clubcarwash.com block is a COMPLIANCE rule from Ben's CCW NDA/non-compete, not
-- a capacity rule. It is deliberately not time-boxed. Do not remove it.
--
-- BOTH FUNCTIONS ARE UPDATED TOGETHER, on purpose. handle_new_user() enforces; and
-- beta_status() is what AuthGate reads to decide whether to show the signup form or
-- the waitlist. Change one and not the other and the UI tells people signups are
-- closed while the database happily accepts them, or the reverse.

-- ---------- handle_new_user ----------
create or replace function public.handle_new_user()
returns trigger as $$
declare
  beta_cap constant int := 250;
  trial_days constant int := 7;
  external_count int;
begin
  -- COMPLIANCE. First, and permanent. See 20260812000000_restore_ccw_domain_block.sql.
  if new.email ilike '%@clubcarwash.com' then
    raise exception 'DOMAIN_BLOCKED: % is not eligible for this app', new.email;
  end if;

  -- Capacity only. No close-date check: a publicly listed app must not refuse
  -- registration on a calendar date.
  select count(*) into external_count
  from public.profiles
  where is_internal_pilot = false;

  if external_count >= beta_cap then
    raise exception 'BETA_FULL: cap of % reached', beta_cap;
  end if;

  insert into public.profiles (id, email, tos_accepted_at, tos_version, trial_ends_at)
  values (
    new.id,
    new.email,
    case
      when new.raw_user_meta_data ->> 'tos_accepted_at' is not null
        then (new.raw_user_meta_data ->> 'tos_accepted_at')::timestamptz
      else null
    end,
    new.raw_user_meta_data ->> 'tos_version',
    -- Rolling, not clamped to a shared date. This is the whole point of the migration.
    now() + make_interval(days => trial_days)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------- beta_status ----------
-- Signature unchanged: AuthGate reads (is_full, is_closed, external_count, cap,
-- close_date) and computes signupClosed = is_full OR is_closed. Changing the shape
-- would break that RPC silently, so is_closed simply stops ever being true.
create or replace function public.beta_status()
returns table(is_full boolean, is_closed boolean, external_count int, cap int, close_date timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  beta_cap constant int := 250;
  -- Reported, no longer enforced. Kept so the pricing/comms date has one home in the
  -- database; if signups ever need closing again, make it a real check here AND in
  -- handle_new_user, and think first about what a store visitor sees when it fires.
  beta_close_date constant timestamptz := '2026-11-15 00:00:00-05';
  current_count int;
begin
  select count(*) into current_count from public.profiles where is_internal_pilot = false;
  return query select
    (current_count >= beta_cap),
    false,
    current_count,
    beta_cap,
    beta_close_date;
end;
$$;

grant execute on function public.beta_status() to anon, authenticated;

-- ---------- NOT changed, deliberately ----------
-- Existing users keep the trial_ends_at they already have. 20260727000003 backfilled
-- every account that predates it to 2026-11-15, so the twelve pilots still expire
-- together on that date. That is a business decision, not a bug: they have had the
-- product free for months, and the beta was always framed as free until 15 November.
-- If you want to move them, do it explicitly and knowingly:
--
--   update public.profiles set trial_ends_at = <date>
--    where trial_ends_at = timestamptz '2026-11-15 05:00:00-06';
--
-- Note trial_ends_at is protected against client edits by the guard trigger in
-- 20260727000003, so that update has to run as service role — which is correct.
