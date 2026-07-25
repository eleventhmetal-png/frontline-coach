-- Frontline Coach — add Stripe linkage columns to profiles, and extend the
-- existing lock_profile_role() trigger to protect them the same way it
-- already protects `role`.
--
-- Without this, the "profiles: update own" RLS policy would let a signed-in
-- user overwrite their own stripe_subscription_id from the browser -- e.g.
-- clearing it right before canceling, which would sever the link the
-- webhook (stripe-webhook.mjs) relies on to find their profile and downgrade
-- them back to free on customer.subscription.deleted. Same vulnerability
-- class the July 21 migration closed for `role`; closing it here too rather
-- than introducing a fresh instance of it.
--
-- Note: the actual plan gate (paid vs free) lives in auth.users.app_metadata,
-- NOT in these columns -- see beta_gate migration comments and claude.mjs.
-- These two columns are reference/lookup only, but still need protecting
-- because the webhook trusts them to find the right user.

alter table public.profiles
  add column stripe_customer_id text,
  add column stripe_subscription_id text unique;

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
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
