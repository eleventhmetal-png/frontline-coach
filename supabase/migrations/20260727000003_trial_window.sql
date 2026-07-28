-- Frontline Coach — 7-day trial window.
--
-- Model (decided 2026-07-27): free for everyone during the beta, then a 7-day
-- free trial, then $14.99/mo. NO CARD UP FRONT and NO Stripe trial period —
-- Stripe is touched only at the moment somebody chooses to subscribe. A card wall
-- at signup would kill cold search traffic, which is the entire point of the eight
-- content pages. Leave "Trials" empty on the Stripe product.
--
-- Nobody is ever charged automatically. At day 8 the proxy refuses and the app
-- shows a paywall; if they don't subscribe, nothing happens.

alter table public.profiles
  add column trial_ends_at timestamptz;

-- Every existing account is a beta tester. Beta runs to 15 Nov 2026 and those
-- users were promised the full product with no limits, so backfill them to the
-- beta end date rather than starting a 7-day clock on people who signed up weeks
-- ago. Their trial effectively begins when the beta ends.
update public.profiles
   set trial_ends_at = timestamptz '2026-11-15 05:00:00-06'
 where trial_ends_at is null;

-- New signups get 7 days from account creation. Same trigger that already
-- enforces the beta cap and the blocked domain — see the beta_gate and
-- block_ccw_domain migrations. Only the INSERT of the profile row changes.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  beta_cap constant int := 30;
  beta_close_date constant timestamptz := '2026-11-15 00:00:00-05';
  trial_days constant int := 7;
  external_count int;
begin
  if now() > beta_close_date then
    raise exception 'BETA_CLOSED: signups closed on %', beta_close_date;
  end if;

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
    -- While the beta is open, everyone runs to the beta end date. After it
    -- closes this branch is unreachable anyway (the guard above raises), so the
    -- 7-day arm is what a post-beta signup would get once the cap/date logic is
    -- relaxed for general availability.
    least(beta_close_date, now() + make_interval(days => trial_days))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Read-only helper so the client can show a countdown without duplicating the
-- date logic. Returns whole days remaining, 0 on the last day, null if the user
-- has no trial set. Negative values clamp to 0 — expired is expired.
create or replace function public.trial_days_left()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
           when p.trial_ends_at is null then null
           else greatest(0, ceil(extract(epoch from (p.trial_ends_at - now())) / 86400)::int)
         end
  from public.profiles p
  where p.id = auth.uid();
$$;

grant execute on function public.trial_days_left() to authenticated;

-- lock_profile_role() already prevents a signed-in user rewriting `role` and the
-- Stripe columns from the browser. trial_ends_at needs the same protection for
-- the same reason: the "profiles: update own" policy would otherwise let anybody
-- grant themselves an unlimited trial.
create or replace function public.lock_profile_role()
returns trigger as $$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role then
      new.role := old.role;
    end if;
    if new.stripe_customer_id is distinct from old.stripe_customer_id then
      new.stripe_customer_id := old.stripe_customer_id;
    end if;
    if new.stripe_subscription_id is distinct from old.stripe_subscription_id then
      new.stripe_subscription_id := old.stripe_subscription_id;
    end if;
    if new.trial_ends_at is distinct from old.trial_ends_at then
      new.trial_ends_at := old.trial_ends_at;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
