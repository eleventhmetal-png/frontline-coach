-- Frontline Coach — Phase 3, Step 2: core schema (profiles, team_members, sessions, memory, reports)
-- Deploys automatically through the Supabase GitHub integration on merge to main.

create extension if not exists pgcrypto;

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------- profiles ----------
-- One row per authenticated user. Created automatically on signup (trigger below).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'manager' check (role in ('owner', 'gm', 'asm', 'tl', 'manager')),
  industry text not null default 'general',
  org_name text,
  tos_accepted_at timestamptz,
  tos_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------- team_members ----------
-- Many-to-many so a district/GM can oversee multiple people and a person
-- can (in matrix orgs) report into more than one manager. Assignment is
-- managed by the app's service role, not self-serve, so no insert/update/
-- delete policy is granted to regular users below.
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (manager_id, member_id)
);

alter table public.team_members enable row level security;

create policy "team_members: visible to either side"
  on public.team_members for select
  using (auth.uid() = manager_id or auth.uid() = member_id);

-- ---------- sessions ----------
-- Every coaching call, logged for legal protection + abuse tracking (Phase 3, step 3).
-- Private to the user who generated it — managers do not get read access to
-- raw session content; only the service role (background jobs, abuse review) does.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool text not null check (tool in ('coach', 'pushback', 'practice', 'convo', 'skill_will', 'document')),
  input jsonb,
  output jsonb,
  model text,
  created_at timestamptz not null default now()
);

create index sessions_user_id_created_at_idx on public.sessions (user_id, created_at desc);

alter table public.sessions enable row level security;

create policy "sessions: insert own"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "sessions: read own"
  on public.sessions for select
  using (auth.uid() = user_id);

-- ---------- memory ----------
-- Synthesized takeaways from past sessions (Phase 3, step 6 background job
-- writes here; table exists now so the job has somewhere to land).
create table public.memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null,
  source_session_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger memory_set_updated_at
  before update on public.memory
  for each row execute procedure public.set_updated_at();

alter table public.memory enable row level security;

create policy "memory: read own"
  on public.memory for select
  using (auth.uid() = user_id);

-- ---------- reports ----------
-- In-app "report a problem" flag (Phase 3, step 5).
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  reason text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "reports: insert own"
  on public.reports for insert
  with check (auth.uid() = user_id);

create policy "reports: read own"
  on public.reports for select
  using (auth.uid() = user_id);

-- ---------- auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger as $$
begin
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
