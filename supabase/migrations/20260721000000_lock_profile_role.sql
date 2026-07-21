-- Frontline Coach — harden profiles: users cannot change their own role.
--
-- The "profiles: update own" RLS policy lets a user update their row, which
-- includes the `role` column. That means a signed-in user could set their own
-- role to 'owner' from the browser. Today `role` is cosmetic, but the moment it
-- gates any feature that becomes a privilege-escalation hole. This trigger
-- silently reverts any role change that comes from an end-user session; the
-- service role (auth.uid() is null for it) can still set roles normally.

create or replace function public.lock_profile_role()
returns trigger as $$
begin
  -- auth.uid() is non-null only for a real end-user session. Service-role /
  -- background jobs run with a null uid and are allowed to change role.
  if new.role is distinct from old.role and auth.uid() is not null then
    new.role := old.role;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists profiles_lock_role on public.profiles;

create trigger profiles_lock_role
  before update on public.profiles
  for each row execute procedure public.lock_profile_role();
