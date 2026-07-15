-- Franchise groups: archive (soft-cancel) support.
--
-- When a franchise cancels we don't want to hard-delete the group (losing its
-- history and relationships) — we archive it. An archived group is hidden from
-- the active oversight/admin lists and is SKIPPED by the central roll-up billing
-- cron, but every relationship (members, admins, brand links, billing mode) is
-- kept intact so it can be restored exactly as it was. Hard delete remains
-- available as the permanent option.

alter table franchise_groups add column if not exists archived_at timestamptz;
