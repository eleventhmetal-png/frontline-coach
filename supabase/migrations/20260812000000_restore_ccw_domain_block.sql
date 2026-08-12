-- Frontline Coach — RESTORE the @clubcarwash.com signup block.
--
-- REGRESSION, introduced 27 July 2026 by 20260727000003_trial_window.sql.
-- That migration did `create or replace function public.handle_new_user()` to
-- add trial_ends_at, and its own comment claims it keeps "the beta cap and the
-- blocked domain" -- but the rewritten body dropped the domain check entirely.
-- A `create or replace` on a trigger function REPLACES THE WHOLE BODY; guards
-- added by an earlier migration do not survive unless they are copied forward.
--
-- Consequence: the block was silently off from 27 July. On 30 July a
-- @clubcarwash.com address signed up successfully -- caught 12 Aug 2026 while
-- reviewing beta usage, not by any alert.
--
-- Why this guard matters more than the cap: it is a COMPLIANCE rule, not a
-- capacity rule. Ben's CCW NDA/non-compete prohibits B2B app sales/use by car
-- wash operators while he is employed there. Unlike beta_cap and
-- beta_close_date it is deliberately NOT time-boxed -- it stays in force after
-- the beta ends, because the underlying obligation does.
--
-- RULE FOR ANY FUTURE EDIT OF THIS FUNCTION: copy every guard forward. The
-- domain check goes FIRST, before cap and date, so a blocked signup gets a
-- distinct reason instead of being reported as "beta full".
--
-- Known limit, unchanged: this only catches the literal domain. A CCW employee
-- signing up with a personal address is a recruiting/vetting problem, not one
-- SQL can solve.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  beta_cap constant int := 30;
  beta_close_date constant timestamptz := '2026-11-15 00:00:00-05';
  trial_days constant int := 7;
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
    least(beta_close_date, now() + make_interval(days => trial_days))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
