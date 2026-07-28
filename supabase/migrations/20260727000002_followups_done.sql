-- Frontline Coach — follow-through tracker: completion state.
--
-- Every one-shot tool already writes a concrete follow-up commitment into its
-- output JSON (coach.followUp, convo.followUpPlan, document.followUpDate,
-- skill_will.followUpInterval). Those have been written and never read back as a
-- list — a manager gets told "check in on Thursday" and the app forgets it said so.
--
-- This table is the missing half: which of those commitments have been handled.
--
-- WHY A SEPARATE TABLE rather than a column on `sessions`: sessions is the
-- append-only coaching log kept for legal protection and abuse review. Adding a
-- user-writable column to it would mean granting UPDATE on that table, and an
-- UPDATE policy broad enough to tick a checkbox is broad enough to rewrite the
-- record of what was actually said. Keeping completion in its own table leaves
-- sessions immutable from the client.
--
-- A follow-up is "open" when its session has a follow-up field and there is no row
-- here. Marking done inserts; un-marking deletes. No status column — presence is
-- the state, which makes the queries trivial and leaves nothing to get out of sync.

create table public.followups_done (
  user_id     uuid not null references auth.users(id) on delete cascade,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  done_at     timestamptz not null default now(),
  primary key (user_id, session_id)
);

alter table public.followups_done enable row level security;

-- Own rows only, all three operations. Unlike usage_daily this IS user-writable —
-- ticking your own follow-up off is the entire point, and there's nothing to gain
-- by faking it. The value being protected is the session record, not this.
create policy "followups_done: read own"
  on public.followups_done for select
  using (auth.uid() = user_id);

create policy "followups_done: insert own"
  on public.followups_done for insert
  with check (auth.uid() = user_id);

create policy "followups_done: delete own"
  on public.followups_done for delete
  using (auth.uid() = user_id);

-- The tracker queries "my open follow-ups, newest first", which means filtering
-- sessions by user and left-joining this. Index the join side.
create index followups_done_user_idx on public.followups_done (user_id);
