-- Cached AI coaching report per sales rep (from their latest certification
-- attempt). Regenerated on demand; one row per rep. Deny-all RLS — owner-only
-- surface, accessed via service-role server code.

create table if not exists sales_cert_reports (
  user_id uuid primary key references profiles(id) on delete cascade,
  attempt_id uuid references sales_cert_attempts(id) on delete set null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

alter table sales_cert_reports enable row level security;
