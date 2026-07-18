-- SMS steps in CRM automations. A sequence step can now be email or sms. SMS
-- steps send via Twilio and are gated on explicit marketing SMS consent + a phone
-- number + not-opted-out (A2P/TCPA). Additive: existing steps default to 'email'.

-- Step channel.
alter table crm_sequence_steps add column if not exists channel text not null default 'email';
alter table crm_sequence_steps drop constraint if exists crm_sequence_steps_channel_check;
alter table crm_sequence_steps add constraint crm_sequence_steps_channel_check check (channel in ('email', 'sms'));

-- Contact SMS consent + opt-out (separate from the email `unsubscribed` flag so
-- the two channels are independent).
alter table crm_contacts add column if not exists sms_marketing_consent boolean not null default false;
alter table crm_contacts add column if not exists sms_transactional_consent boolean not null default false;
alter table crm_contacts add column if not exists sms_opt_out boolean not null default false;

-- Allow logging inbound + outbound SMS in the timeline.
alter table crm_activities drop constraint if exists crm_activities_kind_check;
alter table crm_activities add constraint crm_activities_kind_check
  check (kind in ('lead', 'note', 'email_out', 'email_in', 'sms_out', 'sms_in', 'stage_change', 'system'));
