-- Inbound mailbox sync (Conversations). Poll each connected mailbox for replies
-- from known contacts and thread them as email_in.
alter table calendar_microsoft_accounts add column if not exists mail_synced_at timestamptz; -- poll cursor

-- Dedup ledger so a message is threaded once even if it appears in overlapping
-- poll windows. Only client-matched messages are recorded, so it stays small.
create table if not exists mailbox_seen (
  message_id text primary key,
  seen_at timestamptz not null default now()
);
alter table mailbox_seen enable row level security; -- deny-all: service-role only
