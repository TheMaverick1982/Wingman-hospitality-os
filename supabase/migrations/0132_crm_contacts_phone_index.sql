-- The inbound Twilio webhook (STOP/START) and any phone-based lookups scan
-- crm_contacts by phone, which was unindexed. Add an index so those stay fast as
-- the contact table grows.
create index if not exists crm_contacts_phone_idx on crm_contacts (phone) where phone is not null;
