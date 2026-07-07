-- Singleton row for platform-wide config (e.g. the GA4 measurement ID entered
-- from the platform admin area). Only ever read/written through the
-- service-role admin client, so RLS with zero policies is correct.
create table platform_settings (
  id boolean primary key default true check (id),
  ga_measurement_id text,
  updated_at timestamptz not null default now()
);

alter table platform_settings enable row level security;

insert into platform_settings (id) values (true);
