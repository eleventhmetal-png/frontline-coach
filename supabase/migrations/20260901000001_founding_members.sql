-- Frontline Coach — founding members: the first 100 external accounts lock $7.99/mo.
--
-- THE PROMISE: the pricing page says the earliest signups get $7.99 a month, held for
-- as long as they stay subscribed — not a first-year discount. Decided 1 Sep 2026 to
-- raise that from 30 to 100, because the app is going out nationally and the binding
-- problem is activation, not margin: 100 committed early users are worth more than
-- the revenue difference. The copy on /pricing still says thirty and needs updating.
--
-- WHY A DATABASE FLAG AND NOT A COUNT AT CHECKOUT TIME:
-- create-checkout-session.mjs used to carry this comment — "the Founding price is
-- deliberately NOT in ALLOWED_PRICES, because any signed-in user could call this
-- endpoint directly and lock in the founding rate for themselves." That reasoning was
-- correct and it is why the founding offer has never been purchasable. This migration
-- supersedes it by making eligibility a fact recorded at signup, which the endpoint
-- checks server-side, rather than something inferred from a live count that a caller
-- could race or an unprivileged client could assert.
--
-- Stamped at signup, once, and never recomputed. A user's founding status must not
-- depend on how many people signed up after them.

alter table public.profiles
  add column if not exists is_founding boolean not null default false;

comment on column public.profiles.is_founding is
  'Locked $7.99/mo founding rate. Stamped once at signup for the first 100 external accounts. Never recompute — the promise is for life.';

-- ---------- backfill ----------
-- The 7 existing external accounts are the earliest users there are. They were in the
-- pilot when the offer was thirty, so they qualify by any reading of it. Internal
-- pilots are excluded: they never counted against the cap and they are not customers.
update public.profiles
   set is_founding = true
 where is_internal_pilot = false
   and is_founding = false;

-- ---------- handle_new_user ----------
-- Every guard copied forward again. See 20260812000000 for why that rule exists.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  beta_cap constant int := 250;
  founding_cap constant int := 100;
  trial_days constant int := 7;
  external_count int;
  gets_founding boolean;
begin
  -- COMPLIANCE. First, and permanent. CCW NDA/non-compete — not time-boxed.
  if new.email ilike '%@clubcarwash.com' then
    raise exception 'DOMAIN_BLOCKED: % is not eligible for this app', new.email;
  end if;

  -- One count serves both the cap and the founding stamp. Read inside the trigger, so
  -- it sees the state this insert is joining.
  select count(*) into external_count
  from public.profiles
  where is_internal_pilot = false;

  if external_count >= beta_cap then
    raise exception 'BETA_FULL: cap of % reached', beta_cap;
  end if;

  -- KNOWN AND ACCEPTED RACE: two signups landing in the same instant can both read
  -- 99 and both be stamped founding, so the true ceiling is 100 plus however many
  -- requests arrive concurrently. At this traffic that is a rounding error, and the
  -- alternative — serialising every signup behind an advisory lock — buys precision
  -- nobody will ever measure at the cost of a lock on the hottest path in the system.
  -- If founding ever becomes a number Ben has to defend publicly, take the lock then.
  gets_founding := external_count < founding_cap;

  insert into public.profiles (id, email, tos_accepted_at, tos_version, trial_ends_at, is_founding)
  values (
    new.id,
    new.email,
    case
      when new.raw_user_meta_data ->> 'tos_accepted_at' is not null
        then (new.raw_user_meta_data ->> 'tos_accepted_at')::timestamptz
      else null
    end,
    new.raw_user_meta_data ->> 'tos_version',
    now() + make_interval(days => trial_days),
    gets_founding
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------- lock_profile_role ----------
-- CRITICAL. The "profiles: update own" policy lets a signed-in user write their own
-- row from the browser with the anon key. Without this, anyone could run
--   update profiles set is_founding = true where id = auth.uid()
-- and buy the $7.99 rate for life. That is the exact self-grant the old
-- create-checkout-session comment was protecting against, so the guard has to move
-- with the logic. Every previously locked column is copied forward — this function has
-- been silently truncated by a create-or-replace once before.
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
    if new.is_founding is distinct from old.is_founding then
      new.is_founding := old.is_founding;
    end if;
    if new.is_internal_pilot is distinct from old.is_internal_pilot then
      new.is_internal_pilot := old.is_internal_pilot;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------- founding_status() ----------
-- Anon-callable, aggregate only, so the marketing copy can say how many founding
-- slots are left without exposing the profiles table. Same pattern and same reasoning
-- as beta_status().
create or replace function public.founding_status()
returns table(taken int, cap int, remaining int, is_open boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  founding_cap constant int := 100;
  current_count int;
begin
  select count(*) into current_count from public.profiles where is_founding = true;
  return query select
    current_count,
    founding_cap,
    greatest(0, founding_cap - current_count),
    (current_count < founding_cap);
end;
$$;

grant execute on function public.founding_status() to anon, authenticated;
