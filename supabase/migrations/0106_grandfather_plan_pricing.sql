-- Grandfather every organization onto the price it signed up at.
--
-- Until now the effective price read platform_pricing LIVE, so raising the
-- plan price in Admin -> Billing would silently re-price every existing paying
-- customer on their next receipt. That's not what we want: a price change must
-- only apply to NEW signups. Existing customers keep the price they agreed to.
--
-- We do that by snapshotting the plan rates onto each org (plan_first_cents /
-- plan_addl_cents). The pricing engine prefers an org's locked rates and only
-- falls back to the live platform_pricing when they're absent (free/demo orgs,
-- or a brand-new row a millisecond before the lock trigger fires). Per-org
-- negotiated overrides (custom_monthly_cents / custom_addl_location_cents) still
-- win over the locked standard rate exactly as before.

alter table organizations
  add column if not exists plan_first_cents integer,
  add column if not exists plan_addl_cents integer;

comment on column organizations.plan_first_cents is
  'Locked first-location price (cents) captured at signup. NULL = follow live platform_pricing. Grandfathers the org against later price changes.';
comment on column organizations.plan_addl_cents is
  'Locked additional-location price (cents) captured at signup. NULL = follow live platform_pricing.';

-- Lock the plan price onto every new non-free, non-demo org at creation time,
-- reading whatever platform_pricing is in effect right then. Runs for ALL insert
-- paths (self-serve signup, admin-created orgs) without touching each one.
create or replace function lock_org_plan_pricing() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if new.plan_first_cents is null
     and not coalesce(new.is_free_account, false)
     and not coalesce(new.is_demo, false) then
    select first_location_cents, addl_location_cents
      into new.plan_first_cents, new.plan_addl_cents
      from platform_pricing
      limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_org_plan_pricing on organizations;
create trigger lock_org_plan_pricing
  before insert on organizations
  for each row execute function lock_org_plan_pricing();

-- Grandfather everyone who already exists: snapshot today's platform price onto
-- every current non-free, non-demo org that isn't locked yet. Today's price is
-- the price they're on, so this freezes their bill against future changes.
update organizations o
  set plan_first_cents = p.first_location_cents,
      plan_addl_cents = p.addl_location_cents
  from platform_pricing p
  where o.plan_first_cents is null
    and not coalesce(o.is_free_account, false)
    and not coalesce(o.is_demo, false);

-- Customers (Super Admins) can update their own org row, so the locked plan
-- rates must be protected from the API just like the other billing columns:
-- only service-role writes (auth.uid() is null) may change them.
create or replace function protect_org_pricing() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if auth.uid() is not null
     and (new.custom_monthly_cents is distinct from old.custom_monthly_cents
       or new.custom_addl_location_cents is distinct from old.custom_addl_location_cents
       or new.plan_first_cents is distinct from old.plan_first_cents
       or new.plan_addl_cents is distinct from old.plan_addl_cents
       or new.is_free_account is distinct from old.is_free_account
       or new.billing_status is distinct from old.billing_status) then
    raise exception 'Billing and pricing can only be changed by platform staff';
  end if;
  return new;
end;
$$;
