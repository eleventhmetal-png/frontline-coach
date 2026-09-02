-- Frontline Coach — track which trial-ending emails have been sent.
--
-- WHY THIS EXISTS: nothing tells a user their trial is ending. No warning, no email,
-- nothing but a countdown pill they only see if they happen to open the app. They find
-- out by hitting a wall. For a product whose measured problem is that people do not come
-- back (0 second-day returns as of 12 Aug), that is the most expensive gap in it.
--
-- It matters more now than it did last week: trials became a ROLLING seven days on
-- 1 Sep, so from around 8 Sep they start expiring continuously instead of all on one
-- date, and the iOS app has no purchase path at all (Paywall is gated by IS_STORE_BUILD
-- for Guideline 3.1.1). The email is therefore not just a nudge — until the in-app
-- link-out ships, it is the ONLY route an iPhone user has to subscribe. Apple's rules
-- govern the app, not what we send to our own customers, so this needs no review.
--
-- TWO TIMESTAMPS, NOT A BOOLEAN. Idempotency is the whole job of this table: the sender
-- runs on a daily schedule and can be triggered manually, so it will absolutely run
-- twice on the same day at some point. Recording WHEN each of the two emails went lets
-- the query skip anyone already contacted, and lets us answer "did we email this person"
-- later without keeping a separate log.

alter table public.profiles
  add column if not exists trial_reminder_2d_at  timestamptz,
  add column if not exists trial_reminder_end_at timestamptz;

comment on column public.profiles.trial_reminder_2d_at is
  'When the "two days left" email was sent. Null means not yet. Guards against the daily job double-sending.';
comment on column public.profiles.trial_reminder_end_at is
  'When the "trial has ended" email was sent. Null means not yet.';

-- ---------- lock_profile_role: guard both columns ----------
-- Same reasoning as every other column added to this trigger: "profiles: update own"
-- lets a signed-in user write their own row from the browser, and a user who could null
-- these out would get emailed repeatedly. Every previously locked column copied forward
-- — this function has been silently truncated by a create-or-replace once before.
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
    if new.trial_reminder_2d_at is distinct from old.trial_reminder_2d_at then
      new.trial_reminder_2d_at := old.trial_reminder_2d_at;
    end if;
    if new.trial_reminder_end_at is distinct from old.trial_reminder_end_at then
      new.trial_reminder_end_at := old.trial_reminder_end_at;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------- trial_reminder_queue() ----------
-- Who to email right now, and which of the two emails they get. Kept in SQL rather than
-- in the function so the selection rules are one thing in one place, and so a dry run is
-- a select rather than a deploy.
--
-- RULES, each of which exists for a reason:
--   * is_internal_pilot = false — the pilots are not customers and several are on trials
--     pinned years out. Emailing them "your trial ends" would be nonsense.
--   * founding_slot_claimed_at is null AND stripe_subscription_id is null — never email a
--     paying customer about a trial they already converted out of. app_metadata.plan
--     lives in auth.users and is not readable from here, so these two columns are the
--     usable proxy, and both are written only by the webhook.
--   * trial_ends_at is not null — an account with no trial date is a data problem, not a
--     recipient.
--   * The "ended" email only goes out within 3 days of expiry. Someone whose trial
--     lapsed in July does not want a "your trial just ended" email in September; if this
--     job has been broken for a month, the correct behaviour is to stay quiet, not to
--     mail a backlog.
create or replace function public.trial_reminder_queue()
returns table(user_id uuid, email text, kind text, trial_ends_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, p.email,
         case when p.trial_ends_at > now() then 'two_days' else 'ended' end,
         p.trial_ends_at
    from public.profiles p
   where p.is_internal_pilot = false
     and p.trial_ends_at is not null
     and p.email is not null
     and p.founding_slot_claimed_at is null
     and p.stripe_subscription_id is null
     and (
           -- inside the last two days of the trial, not yet warned
           (p.trial_ends_at > now()
            and p.trial_ends_at <= now() + interval '2 days'
            and p.trial_reminder_2d_at is null)
        or -- expired within the last three days, not yet told
           (p.trial_ends_at <= now()
            and p.trial_ends_at > now() - interval '3 days'
            and p.trial_reminder_end_at is null)
         )
   order by p.trial_ends_at;
$$;

-- ---------- mark_trial_reminder_sent() ----------
-- Called per recipient AFTER the provider accepts the message. Deliberately not a bulk
-- update: if the send fails halfway down the list, the people who were not emailed must
-- still be in tomorrow's queue.
create or replace function public.mark_trial_reminder_sent(p_user_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind = 'two_days' then
    update public.profiles set trial_reminder_2d_at = now() where id = p_user_id;
  elsif p_kind = 'ended' then
    update public.profiles set trial_reminder_end_at = now() where id = p_user_id;
  else
    raise exception 'unknown reminder kind: %', p_kind;
  end if;
end;
$$;

revoke execute on function public.trial_reminder_queue()                    from public, anon, authenticated;
revoke execute on function public.mark_trial_reminder_sent(uuid, text)      from public, anon, authenticated;
grant  execute on function public.trial_reminder_queue()                    to service_role;
grant  execute on function public.mark_trial_reminder_sent(uuid, text)      to service_role;
