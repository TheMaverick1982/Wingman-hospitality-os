-- Tie a login (profile) to its Staff record, so a person is ONE entry across
-- hiring, training, and login instead of being retyped in each place. The
-- invite / hire flows set this; staff_members.candidate_id already links the
-- hiring side. Dedupe itself is enforced in application code (by email), which
-- avoids breaking existing rows that share a blank email.
alter table staff_members add column if not exists profile_id uuid references profiles(id) on delete set null;
create index if not exists staff_members_profile_id_idx on staff_members(profile_id);
