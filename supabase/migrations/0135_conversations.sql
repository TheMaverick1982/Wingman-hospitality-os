-- Conversations (platform-admin inbox for email + SMS with contacts). The message
-- history already lives in crm_activities (email_out/email_in/sms_out/sms_in);
-- these columns power the inbox list ordering + unread state without a group-by.
alter table crm_contacts add column if not exists last_message_at timestamptz;   -- any message, in or out
alter table crm_contacts add column if not exists last_inbound_at timestamptz;    -- last message FROM the contact
alter table crm_contacts add column if not exists convo_read_at timestamptz;      -- when an admin last opened the thread

-- Inbox is ordered by most-recent message; unread = last_inbound_at > convo_read_at.
create index if not exists crm_contacts_last_message_idx on crm_contacts (last_message_at desc) where last_message_at is not null;
