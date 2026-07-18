-- Outlook / Microsoft 365 calendar support. A rep can connect Google and/or
-- Outlook calendars; we merge free/busy across all of them and create the booking
-- event on whichever calendar hosts it.
--
-- Mirrors calendar_google_accounts. Tokens are SECRETS: deny-all RLS (enabled, no
-- policies), service-role access only.

create table if not exists calendar_microsoft_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ms_sub text not null,                    -- Microsoft Graph account id (/me id)
  email text not null default '',
  access_token text not null default '',
  refresh_token text not null default '',
  token_expires_at timestamptz,
  scopes text not null default '',
  calendar_id text not null default '',    -- '' = the user's default calendar
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, ms_sub)
);
create index if not exists calendar_microsoft_accounts_user_idx on calendar_microsoft_accounts (user_id);

alter table calendar_microsoft_accounts enable row level security;  -- deny-all: service-role only

-- Which provider hosts a booking, and the Outlook account when it's Outlook-hosted
-- (google_account_id already covers Google-hosted bookings).
alter table calendar_bookings add column if not exists provider text not null default 'google';
alter table calendar_bookings add column if not exists microsoft_account_id uuid references calendar_microsoft_accounts(id) on delete set null;
