-- Frontline Coach — move the usage day boundary from UTC midnight to 5am Central.
--
-- WHY: the original table used (now() at time zone 'utc')::date, so credits reset
-- at 7pm Central. That's mid-evening for a frontline supervisor — somebody working
-- a close got a reset partway through their shift, which reads as arbitrary rather
-- than generous. It also allowed a double-dip: burn 100 points at 6pm, get a fresh
-- 100 at 7pm, burn those before midnight.
--
-- 5am Central is the boundary that matches when a shift actually starts.
--
-- DST: 'America/Chicago' is DST-aware, so the boundary stays at 5am local year
-- round rather than drifting an hour twice a year. That's why this uses a named
-- zone instead of a fixed -6 offset.
--
-- The client computes the same value in src/lib/credits.js (usageDay). If these
-- two ever disagree, the meter reads a different row than the proxy writes and the
-- pill silently shows the wrong number — so they have to change together.

-- Single definition of "which usage day is it right now".
-- Shift Chicago wall-clock back 5 hours, then take the date: at 04:59 local the
-- shifted time is still the previous day, at 05:00 it rolls over.
create or replace function public.usage_day()
returns date
language sql
stable
as $$
  select ((now() at time zone 'America/Chicago') - interval '5 hours')::date;
$$;

grant execute on function public.usage_day() to service_role, authenticated, anon;

alter table public.usage_daily
  alter column day set default public.usage_day();

-- Both RPCs have to use the same definition, or a spend and a refund inside the
-- same shift could land on different rows.
create or replace function public.consume_credits(p_user_id uuid, p_points integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total integer;
begin
  insert into public.usage_daily (user_id, day, points)
  values (p_user_id, public.usage_day(), greatest(p_points, 0))
  on conflict (user_id, day) do update
    set points = public.usage_daily.points + greatest(p_points, 0),
        updated_at = now()
  returning points into new_total;
  return new_total;
end;
$$;

create or replace function public.refund_credits(p_user_id uuid, p_points integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total integer;
begin
  update public.usage_daily
     set points = greatest(points - greatest(p_points, 0), 0),
         updated_at = now()
   where user_id = p_user_id
     and day = public.usage_day()
  returning points into new_total;
  return coalesce(new_total, 0);
end;
$$;

create or replace function public.prune_usage_daily()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.usage_daily
   where day < (public.usage_day() - interval '60 days');
$$;

-- CREATE OR REPLACE preserves existing grants, but re-stating them keeps this
-- migration safe to run standalone. service_role inherits EXECUTE from PUBLIC,
-- so the revokes in the previous migration stripped it — see that file's note.
revoke execute on function public.consume_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_credits(uuid, integer)  from public, anon, authenticated;
revoke execute on function public.prune_usage_daily()            from public, anon, authenticated;
grant  execute on function public.consume_credits(uuid, integer) to service_role;
grant  execute on function public.refund_credits(uuid, integer)  to service_role;
grant  execute on function public.prune_usage_daily()            to service_role;

-- No backfill needed. The one existing row (2026-07-27, written at 22:30 UTC =
-- 17:30 Chicago) resolves to the same date under the new rule.
