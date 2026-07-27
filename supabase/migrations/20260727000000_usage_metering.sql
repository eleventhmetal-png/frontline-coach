-- Frontline Coach — daily AI usage metering.
--
-- WHY THIS EXISTS: before this, the only difference between free and paid was
-- TIER_MAX_TOKENS in claude.mjs (an output-length ceiling). Free users had
-- unlimited access to every tool, which meant (a) nothing to sell, and (b) a
-- single user could burn the whole Anthropic spend cap. This table is the meter.
--
-- Points, not dollars, in the user-facing layer. 1 point = $0.0025 of real
-- compute. Free tier = 100 points/day ≈ $0.25. The proxy computes the cost of
-- each request from measured input size + max_tokens + the model's rates, so the
-- charge can't be spoofed by a client lying about which tool it is.
--
-- Counting lives HERE and is written by the proxy with the service role, NOT
-- derived from public.sessions. sessions is written client-side by
-- src/lib/sessionLog.js, so a user could simply not log a call. Anything used
-- for billing has to be server-authored.

create table public.usage_daily (
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null default (now() at time zone 'utc')::date,
  points      integer not null default 0,
  -- Voice is metered in seconds rather than points: it's billed per minute
  -- upstream, an order of magnitude more expensive than text, and capped
  -- monthly rather than daily. Column exists now so the voice endpoint has
  -- somewhere to write on day one. Nothing writes it yet.
  voice_secs  integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.usage_daily enable row level security;

-- Users can read their own meter (the pill in the app header needs this).
-- Nobody can INSERT/UPDATE/DELETE from the client — no policy is granted for
-- those, so only the service role (the proxy) can write. That's deliberate:
-- a user who could update this row could hand themselves unlimited usage.
create policy "usage: read own"
  on public.usage_daily for select
  using (auth.uid() = user_id);

-- Atomic upsert-and-increment. Called by the proxy with the service role before
-- the upstream request, so two concurrent calls can't both slip under the limit.
-- Returns the new running total so the proxy can decide without a second read.
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
  values (p_user_id, (now() at time zone 'utc')::date, greatest(p_points, 0))
  on conflict (user_id, day) do update
    set points = public.usage_daily.points + greatest(p_points, 0),
        updated_at = now()
  returning points into new_total;
  return new_total;
end;
$$;

-- Refund path: if the upstream call fails we shouldn't charge for it. Same
-- function with a negative delta would work, but a named function keeps the
-- intent readable in the proxy and floors at zero.
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
     and day = (now() at time zone 'utc')::date
  returning points into new_total;
  return coalesce(new_total, 0);
end;
$$;

-- Only the proxy (service role) may spend or refund. Leaving these callable by
-- `authenticated` would let a signed-in user refund themselves to zero.
revoke execute on function public.consume_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_credits(uuid, integer)  from public, anon, authenticated;

-- Housekeeping: usage rows older than 60 days are dead weight. The
-- synthesize-memory function already runs on cron and can call this.
create or replace function public.prune_usage_daily()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.usage_daily
   where day < ((now() at time zone 'utc')::date - interval '60 days');
$$;

revoke execute on function public.prune_usage_daily() from public, anon, authenticated;
