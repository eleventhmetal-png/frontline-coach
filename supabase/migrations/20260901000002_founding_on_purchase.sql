-- Frontline Coach — founding is claimed by PURCHASE, not by signup.
--
-- SUPERSEDES 20260901000001, written an hour earlier and wrong. That version stamped
-- is_founding on the first 100 accounts to REGISTER. Ben's correction: "it needs to be
-- the first 100 to purchase. we have 250 user limit… only the first 100 get the for
-- life deal." Those are very different offers. Under the old logic 100 free signups
-- could consume every founding slot without a cent changing hands, and the promise
-- would be spent on people who never converted — with 0 second-day returns, most of
-- them. Tying it to purchase means the slot is only ever given to someone who paid.
--
-- The 7 existing external accounts are un-stamped for the same reason: they have not
-- purchased. They can still claim a slot by being among the first 100 to subscribe.
--
-- TWO COLUMNS, NOT ONE. The pricing page says the rate holds "for as long as they stay
-- subscribed", and "cancel and the rate goes with you — you'd rejoin at $14.99". That
-- needs both a historical fact and a current entitlement:
--   founding_slot_claimed_at  when this account claimed one of the 100. NEVER cleared.
--                             This is what counts against the cap, so a slot is spent
--                             once and not recycled by churn — "first 100 to purchase"
--                             read literally, and the only version that can be audited
--                             later without reconstructing subscription history.
--   is_founding               entitled to $7.99 RIGHT NOW. Cleared on cancellation.
-- A cancelled founder therefore keeps their claim (so nobody else inherits the slot)
-- but loses the rate, and cannot re-buy at $7.99 because the checkout gate requires an
-- unclaimed slot. That is exactly what the published copy promises.

alter table public.profiles
  add column if not exists founding_slot_claimed_at timestamptz;

comment on column public.profiles.founding_slot_claimed_at is
  'When this account claimed one of the 100 founding slots, by purchasing. Never cleared - a spent slot is not recycled. Counts against the cap.';

comment on column public.profiles.is_founding is
  'Entitled to the $7.99 founding rate right now. Set by the Stripe webhook on purchase, cleared on cancellation. Claim history lives in founding_slot_claimed_at.';

-- ---------- undo the signup-time backfill ----------
-- Nobody has purchased anything (MRR $0, zero subscriptions on every price as of
-- 1 Sep 2026), so nobody has earned a slot yet.
update public.profiles
   set is_founding = false,
       founding_slot_claimed_at = null
 where is_founding = true
    or founding_slot_claimed_at is not null;

-- ---------- handle_new_user: no longer touches founding ----------
-- Every guard copied forward. See 20260812000000 for why that rule exists.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  beta_cap constant int := 250;
  trial_days constant int := 7;
  external_count int;
begin
  -- COMPLIANCE. First, and permanent. CCW NDA/non-compete — not time-boxed.
  if new.email ilike '%@clubcarwash.com' then
    raise exception 'DOMAIN_BLOCKED: % is not eligible for this app', new.email;
  end if;

  select count(*) into external_count
  from public.profiles
  where is_internal_pilot = false;

  if external_count >= beta_cap then
    raise exception 'BETA_FULL: cap of % reached', beta_cap;
  end if;

  -- No founding stamp here. Signing up earns nothing; buying does.
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
    now() + make_interval(days => trial_days)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------- lock_profile_role: guard the new column too ----------
-- The "profiles: update own" policy lets a signed-in user write their own row with the
-- anon key. Both founding columns have to be unwritable from the browser or the $7.99
-- rate is self-service. The Stripe webhook writes them with the service role, which has
-- no auth.uid() and so passes straight through this guard — that is by design, and the
-- reason the whole function is wrapped in the auth.uid() check.
-- Every previously locked column copied forward; this function has been silently
-- truncated by a create-or-replace once before.
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
    if new.founding_slot_claimed_at is distinct from old.founding_slot_claimed_at then
      new.founding_slot_claimed_at := old.founding_slot_claimed_at;
    end if;
    if new.is_internal_pilot is distinct from old.is_internal_pilot then
      new.is_internal_pilot := old.is_internal_pilot;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------- founding_status(): counts CLAIMED slots ----------
-- Counts founding_slot_claimed_at, not is_founding, so a cancelled founder's slot stays
-- spent. Anon-callable and aggregate-only, so marketing copy can say how many remain
-- without exposing profiles. Same pattern as beta_status().
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
  select count(*) into current_count
    from public.profiles
   where founding_slot_claimed_at is not null;
  return query select
    current_count,
    founding_cap,
    greatest(0, founding_cap - current_count),
    (current_count < founding_cap);
end;
$$;

grant execute on function public.founding_status() to anon, authenticated;

-- ACCEPTED RACE, now on the purchase path: two checkouts can both see 99 claimed and
-- both complete, so the true ceiling is 100 plus concurrent purchases. At $0 MRR and a
-- trickle of store traffic this is theoretical. If founding ever becomes a number Ben
-- has to defend publicly, the fix is a claim reserved inside a transaction at checkout
-- creation with a short expiry — not an advisory lock on signup.
