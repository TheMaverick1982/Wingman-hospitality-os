-- Per-org AI usage ledger. Every Anthropic call records its token usage against
-- the org it was made for (null = platform/internal, e.g. Wingman's own social
-- generation), so the platform admin can see total AI spend and a per-client
-- breakdown. RLS-enabled with NO policies: normal clients can't read it; only
-- the service-role client (platform admin + the logging helper) touches it.
create table ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_events_org_idx on ai_usage_events(org_id, created_at desc);
create index ai_usage_events_created_idx on ai_usage_events(created_at desc);

alter table ai_usage_events enable row level security;
-- No policies: deny-all to RLS clients; the service-role client bypasses RLS.
