-- Pending Clover installs — for the App-Market "launched from Clover" flow.
--
-- When a merchant installs Wingman from the Clover App Market and launches it,
-- Clover redirects to our callback with a merchant_id + auth code but NO Wingman
-- login session (and none of the CSRF state our own "Connect" button sets). We
-- exchange the short-lived code immediately (it expires fast) and stash the
-- resulting token here keyed by a random nonce, then finish linking it to the
-- merchant's Wingman org once they sign in.
--
-- Holds a secret token, so — like clover_connections — RLS is enabled with NO
-- policies (deny-all). Access is service-role only, and the nonce lives in an
-- httpOnly cookie.

create table if not exists clover_pending_installs (
  id uuid primary key default gen_random_uuid(),
  merchant_id text not null,
  merchant_name text not null default '',
  access_token text not null,
  refresh_token text not null default '',
  token_expires_at timestamptz,
  refresh_expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table clover_pending_installs enable row level security;
-- Deny-all: no policies. Service-role only.
