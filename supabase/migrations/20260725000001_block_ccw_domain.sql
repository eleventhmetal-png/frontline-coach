-- Frontline Coach — permanently block @clubcarwash.com signups.
--
-- This is a compliance rule, not a beta-capacity rule: Ben's CCW NDA/non-
-- compete prohibits B2B app sales/use by car wash operators while he's
-- employed there, and the external beta must stay genuinely external (the
-- CCW GM pilot is a separate, CEO-sanctioned internal exception, already
-- excluded via is_internal_pilot -- see beta_gate migration). Unlike the
-- 30-cap/Nov-15 cutoff, this check is NOT time-boxed to the beta window --
-- it stays in effect indefinitely, independent of beta_cap/beta_close_date,
-- because the underlying NDA obligation doesn't expire when the beta does.
--
-- Limit: this can only catch the literal @clubcarwash.com domain. It cannot
-- detect a CCW employee signing up with a personal email address -- that
-- still depends on how the 30 external testers are actually recruited and
-- vetted, same as it always has.
--
-- Checked first, before the cap/date logic, so a blocked signup gets a
-- distinct reason rather than being lumped in with "beta full/closed".

create or replace function public.handle_new_user()
returns trigger as $$
declare
  beta_cap constant int := 30;
  beta_close_date constant timestamptz := '2026-11-15 00:00:00-05';
  external_count int;
begin
  if new.email ilike '%@clubcarwash.com' then
    raise exception 'DOMAIN_BLOCKED: % is not eligible for this app', new.email;
  end if;

  if now() > beta_close_date then
    raise exception 'BETA_CLOSED: signups closed on %', beta_close_date;
  end if;

  select count(*) into external_count
  from public.profiles
  where is_internal_pilot = false;

  if external_count >= beta_cap then
    raise exception 'BETA_FULL: cap of % reached', beta_cap;
  end if;

  insert into public.profiles (id, email, tos_accepted_at, tos_version)
  values (
    new.id,
    new.email,
    case
      when new.raw_user_meta_data ->> 'tos_accepted_at' is not null
        then (new.raw_user_meta_data ->> 'tos_accepted_at')::timestamptz
      else null
    end,
    new.raw_user_meta_data ->> 'tos_version'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
