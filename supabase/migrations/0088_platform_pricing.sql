-- Platform-wide plan pricing, editable by platform staff. A single row (the
-- boolean PK enforces the singleton). Standard: first location + each
-- additional. Read across the app (marketing pages, billing, calculator) so
-- one change here updates the price everywhere.
create table if not exists platform_pricing (
  id boolean primary key default true check (id),
  first_location_cents integer not null default 39900,
  addl_location_cents integer not null default 14900,
  updated_at timestamptz not null default now()
);

insert into platform_pricing (id) values (true) on conflict (id) do nothing;

alter table platform_pricing enable row level security;
-- Price isn't secret; anyone may read it. Writes go through the service-role
-- client after an app-level platform-admin check.
drop policy if exists platform_pricing_select on platform_pricing;
create policy platform_pricing_select on platform_pricing for select using (true);
