-- Star/flag a conversation in the Team inbox. Additive boolean on crm_contacts;
-- powers the "Starred" tab. All access is via the service-role client.
alter table crm_contacts add column if not exists convo_starred boolean not null default false;
