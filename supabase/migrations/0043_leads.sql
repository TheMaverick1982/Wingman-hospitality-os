-- Marketing leads captured by public tools (revenue calculator, free scorecard).
-- Written by server actions using the service-role client; read by platform staff.

create table leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  source text not null,          -- 'calculator' | 'scorecard'
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index leads_created_idx on leads(created_at desc);

alter table leads enable row level security;
-- No public policies: all writes go through server actions (service role); reads
-- happen in the admin area via the service-role client.
