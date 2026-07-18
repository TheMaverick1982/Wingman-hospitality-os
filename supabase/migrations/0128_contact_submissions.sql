-- Contact form submissions. Also the durable record of SMS opt-in consent
-- (timestamp + IP + which checkboxes + the exact consent text shown) required for
-- A2P 10DLC compliance. Deny-all RLS: read/written only via the service-role
-- client in server code.
create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  message text not null default '',
  opt_in_transactional boolean not null default false,
  opt_in_marketing boolean not null default false,
  consent_text text not null default '',   -- verbatim opt-in language the user agreed to
  ip text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists contact_submissions_created_idx on contact_submissions (created_at desc);

alter table contact_submissions enable row level security;  -- deny-all: service-role only
