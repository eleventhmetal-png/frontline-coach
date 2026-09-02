-- Frontline Coach — meter read-aloud voice, and give the free tier a one-time taste.
--
-- WHAT WAS ACTUALLY TRUE BEFORE THIS: nothing gated voice at all. readAloudAvailable()
-- checks browser capability only, tts.mjs verified the JWT and then synthesised for
-- anybody, and PLAN_LIMITS in credits.js — free: 0 seconds, paid: 0, premium: 120
-- min/mo — was read by no code whatsoever. Every user on every tier had unlimited
-- OpenAI TTS. At $0.06–0.10 per minute that was the largest uncapped cost in the
-- product, about to meet a national App Store release.
--
-- DECIDED 1 Sep 2026: Premium only, plus roughly ten minutes lifetime for the free
-- tier so people hear it once. Voice is the most convincing demonstration of what
-- Premium is for, and the binding problem is activation, not margin. Standard gets
-- none, which is PLAN_LIMITS as already written — and that includes founding members,
-- since Founding buys Standard.
--
-- WHY A COLUMN ON profiles AND NOT usage_daily:
-- prune_usage_daily() deletes anything older than 60 days. A "lifetime" allowance
-- stored there would quietly reset every two months and the free taste would become
-- unlimited voice on a slow drip. usage_daily still carries the per-day figure for the
-- monthly premium cap, where a 60-day window is plenty.

alter table public.profiles
  add column if not exists voice_secs_lifetime integer not null default 0;

comment on column public.profiles.voice_secs_lifetime is
  'Total read-aloud seconds ever served to this account. Durable because prune_usage_daily drops usage_daily rows after 60 days, which would reset a lifetime allowance.';

-- ---------- lock_profile_role: guard the counter ----------
-- Without this, "profiles: update own" lets a signed-in user run
--   update profiles set voice_secs_lifetime = 0 where id = auth.uid()
-- and refill their free taste forever. Every previously locked column copied forward;
-- this function has been silently truncated by a create-or-replace once before.
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
    if new.voice_secs_lifetime is distinct from old.voice_secs_lifetime then
      new.voice_secs_lifetime := old.voice_secs_lifetime;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------- voice_usage: read before spending ----------
-- Called by tts.mjs BEFORE it hits OpenAI, so an over-budget request costs nothing.
-- Month is a calendar month off usage_day(), matching how the premium allowance is
-- described to users ("120 min/mo"), and safely inside the 60-day prune window.
create or replace function public.voice_usage(p_user_id uuid)
returns table(month_secs integer, lifetime_secs integer)
language sql
security definer
set search_path = public
as $$
  select
    coalesce((
      select sum(voice_secs)::integer
        from public.usage_daily
       where user_id = p_user_id
         and day >= date_trunc('month', public.usage_day())::date
    ), 0),
    coalesce((
      select voice_secs_lifetime from public.profiles where id = p_user_id
    ), 0);
$$;

-- ---------- consume_voice: record after a successful clip ----------
-- Writes both places in one call: the day row for the monthly cap, and the durable
-- lifetime counter. Called only after OpenAI actually returned audio — a failed
-- synthesis must not spend anyone's allowance.
create or replace function public.consume_voice(p_user_id uuid, p_secs integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_lifetime integer;
begin
  if p_secs is null or p_secs <= 0 then
    select voice_secs_lifetime into new_lifetime from public.profiles where id = p_user_id;
    return coalesce(new_lifetime, 0);
  end if;

  insert into public.usage_daily (user_id, day, voice_secs)
  values (p_user_id, public.usage_day(), p_secs)
  on conflict (user_id, day) do update
    set voice_secs = public.usage_daily.voice_secs + excluded.voice_secs;

  update public.profiles
     set voice_secs_lifetime = voice_secs_lifetime + p_secs
   where id = p_user_id
  returning voice_secs_lifetime into new_lifetime;

  return coalesce(new_lifetime, 0);
end;
$$;

-- Same lockdown as consume_credits: these are service-role only. A client that could
-- call voice_usage for an arbitrary user id would be an information leak, and one that
-- could call consume_voice could zero out someone else's allowance by other means.
revoke execute on function public.voice_usage(uuid)             from public, anon, authenticated;
revoke execute on function public.consume_voice(uuid, integer)  from public, anon, authenticated;
grant  execute on function public.voice_usage(uuid)             to service_role;
grant  execute on function public.consume_voice(uuid, integer)  to service_role;
