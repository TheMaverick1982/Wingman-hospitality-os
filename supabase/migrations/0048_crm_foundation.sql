-- CRM automation foundation (aligning to the Wingman automation spec).
--
-- Adds: per-contact tags + custom fields (so emails can merge {{contact.<key>}}),
-- draft/publish state on sequences, per-step send conditions + transactional
-- flag, and the new "Demo Completed" pipeline stage. Also unpublishes the old
-- live sequences and stops in-flight enrollments so nothing sends until the
-- rebuilt automations are seeded and explicitly published.

alter table crm_contacts
  add column if not exists tags text[] not null default '{}',       -- src:*, aff:* labels
  add column if not exists fields jsonb not null default '{}';      -- calc_*, scorecard_*, workspace_name, etc.
create index if not exists crm_contacts_tags_idx on crm_contacts using gin (tags);

-- Draft/publish: nothing sends until published. (Keeps `active` as a pause switch.)
alter table crm_sequences
  add column if not exists published boolean not null default false;

-- Per-step: conditional sends (WF-05 activated/rescue split) + transactional
-- (email 1 delivers the requested result immediately, bypassing the send window).
alter table crm_sequence_steps
  add column if not exists send_condition text not null default 'always'
    check (send_condition in ('always','activated','not_activated')),
  add column if not exists transactional boolean not null default false;

-- New pipeline stage: Demo Completed (a demo that happened, vs just booked).
alter table crm_contacts drop constraint if exists crm_contacts_stage_check;
alter table crm_contacts add constraint crm_contacts_stage_check
  check (stage in ('new','engaged','demoed','demo_completed','signed_up','lost'));

-- Everything ships draft: unpublish the old live sequences...
update crm_sequences set published = false;
-- ...and stop old-cadence enrollments; new form/signup events re-enter the
-- rebuilt automations once they're published.
update crm_enrollments set status = 'stopped', stopped_reason = 'migration', updated_at = now()
  where status = 'active';
