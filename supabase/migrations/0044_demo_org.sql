-- Demo organization support.
--
-- Wingman runs a single shared "demo" org behind the wingmandemo@gmail.com
-- login. Every time that account signs in, the app wipes and re-seeds this
-- org back to a curated, fully-populated showcase state (see
-- src/lib/demo/reseed.ts) so prospects can click around freely without their
-- edits sticking around for the next viewer.
--
-- This column is the durable marker the reseed engine uses to find (and refuse
-- to touch anything but) the demo org. It is not billing- or privilege-bearing,
-- so it is intentionally left out of the protect_org_pricing() guard.

alter table organizations
  add column if not exists is_demo boolean not null default false;

-- At most one demo org should ever exist. A partial unique index on the flag
-- makes a second one a hard error rather than a silent duplicate the reseed
-- could pick at random.
create unique index if not exists organizations_single_demo_idx
  on organizations (is_demo) where is_demo;
