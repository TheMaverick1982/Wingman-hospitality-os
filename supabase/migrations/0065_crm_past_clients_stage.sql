-- Add a "Past Clients" pipeline stage for churned customers, so a cancellation
-- moves the contact somewhere we can win them back from (via the Reactivation
-- sequence) instead of leaving them stuck in "Signed Up". Extends the stage
-- CHECK constraint from 0046/0048.
alter table crm_contacts drop constraint if exists crm_contacts_stage_check;
alter table crm_contacts
  add constraint crm_contacts_stage_check
  check (stage in ('new', 'engaged', 'demoed', 'demo_completed', 'signed_up', 'past_client', 'lost'));
