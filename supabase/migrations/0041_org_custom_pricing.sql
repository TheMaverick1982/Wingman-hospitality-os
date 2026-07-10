-- Per-organization custom (enterprise) pricing overrides.
--
-- Two optional levers, set only by platform staff from the admin org page:
--   custom_monthly_cents        – a flat negotiated monthly price (overrides the
--                                 whole calculation for that org)
--   custom_addl_location_cents  – a custom per-additional-location rate (keeps
--                                 the $199 base, replaces the $100 add-on)
-- Blank = standard pricing. Never advertised; invisible to other customers.

alter table organizations
  add column if not exists custom_monthly_cents integer,
  add column if not exists custom_addl_location_cents integer,
  add column if not exists pricing_note text;

-- Customers (Super Admins) can update their own organization row (name, weekly
-- focus, etc.), so we must stop them from editing their own PRICE through the
-- API. Only out-of-band writes (service-role / admin actions, where auth.uid()
-- is null) may change the pricing columns.
create or replace function protect_org_pricing() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if auth.uid() is not null
     and (new.custom_monthly_cents is distinct from old.custom_monthly_cents
       or new.custom_addl_location_cents is distinct from old.custom_addl_location_cents) then
    raise exception 'Custom pricing can only be changed by platform staff';
  end if;
  return new;
end;
$$;

create trigger organizations_protect_pricing
  before update on organizations
  for each row execute function protect_org_pricing();
