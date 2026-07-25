-- Frontline Coach — closed beta gate: cap external signups at 30 and cut
-- off new accounts after 2026-11-15.
--
-- Enforced inside handle_new_user(), the one trigger both signup paths
-- (email/password AND "Continue with Google") route through -- both just
-- insert a row into auth.users, which fires this trigger. A client-side
-- check in React would only cover the email form and would do nothing to
-- stop the Google button or a direct API call with the anon key. Raising
-- an exception here aborts the entire auth.users insert transaction, so
-- the account is never created. This is the real gate; nothing else is.
--
-- Internal CCW GM pilot users don't count against the external beta cap.
-- After this migration runs, mark them manually:
--   update public.profiles set is_internal_pilot = true where email in ('gm1@example.com', 'gm2@example.com');

alter table public.profiles
  add column is_internal_pilot boolean not null default false;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  beta_cap constant int := 30;
  beta_close_date constant timestamptz := '2026-11-15 00:00:00-05';
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

-- ---------- beta_status() ----------
-- Read-only, anon-callable check so the signup UI can show a friendly
-- "beta is full/closed" message BEFORE someone submits the form, instead of
-- them hitting a raw database error from the trigger above. This is a UX
-- nicety only -- the trigger above is what actually enforces the cap/date.
-- Anonymous users can't query public.profiles directly (RLS only allows
-- reading your own row), so this security-definer function is the sanctioned
-- way to expose just the aggregate count, nothing else.
create or replace function public.beta_status()
returns table(is_full boolean, is_closed boolean, external_count int, cap int, close_date timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  beta_cap constant int := 30;
  beta_close_date constant timestamptz := '2026-11-15 00:00:00-05';
  current_count int;
begin
  select count(*) into current_count from public.profiles where is_internal_pilot = false;
  return query select
    (current_count >= beta_cap),
    (now() > beta_close_date),
    current_count,
    beta_cap,
    beta_close_date;
end;
$$;

grant execute on function public.beta_status() to anon, authenticated;
