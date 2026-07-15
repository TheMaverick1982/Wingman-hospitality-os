-- Soft-delete + Trash/restore + audit for the highest-value tenant records
-- (guests, partner_contacts, staff_members). A "delete" now just stamps
-- deleted_at, so an owner can restore it from Trash and nothing is lost to a
-- disgruntled employee. Deleted rows are hidden by RLS (a deleted_at IS NULL
-- filter on the SELECT policy), so every existing read excludes them with no
-- app changes; the Trash view reads deleted rows via the service-role client.
--
-- To make the SELECT filter authoritative we split each table's single
-- FOR ALL / write policy into per-command policies — a FOR ALL policy also
-- grants SELECT, which (being permissive/OR-combined) would otherwise expose
-- deleted rows. The org/role/location conditions are preserved exactly.

-- ---------------------------------------------------------------------------
-- guests  (was: guests_all FOR ALL)
-- ---------------------------------------------------------------------------
alter table guests add column if not exists deleted_at timestamptz;
alter table guests add column if not exists deleted_by uuid references profiles(id) on delete set null;

drop policy if exists guests_all on guests;
create policy guests_select on guests for select
  using (org_id = current_org_id() and is_manager_or_above() and deleted_at is null);
create policy guests_insert on guests for insert
  with check (org_id = current_org_id() and is_manager_or_above());
create policy guests_update on guests for update
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());
create policy guests_delete on guests for delete
  using (org_id = current_org_id() and is_manager_or_above());

-- ---------------------------------------------------------------------------
-- staff_members  (was: staff_members_select FOR SELECT + staff_members_write FOR ALL)
-- ---------------------------------------------------------------------------
alter table staff_members add column if not exists deleted_at timestamptz;
alter table staff_members add column if not exists deleted_by uuid references profiles(id) on delete set null;

drop policy if exists staff_members_select on staff_members;
drop policy if exists staff_members_write on staff_members;
create policy staff_members_select on staff_members for select
  using (org_id = current_org_id() and can_access_location(location_id) and deleted_at is null);
create policy staff_members_insert on staff_members for insert
  with check (org_id = current_org_id() and is_manager_or_above() and can_access_location(location_id));
create policy staff_members_update on staff_members for update
  using (org_id = current_org_id() and is_manager_or_above() and can_access_location(location_id))
  with check (org_id = current_org_id() and is_manager_or_above() and can_access_location(location_id));
create policy staff_members_delete on staff_members for delete
  using (org_id = current_org_id() and is_manager_or_above() and can_access_location(location_id));

-- ---------------------------------------------------------------------------
-- partner_contacts  (was: partner_contacts_select FOR SELECT + partner_contacts_write FOR ALL)
-- ---------------------------------------------------------------------------
alter table partner_contacts add column if not exists deleted_at timestamptz;
alter table partner_contacts add column if not exists deleted_by uuid references profiles(id) on delete set null;

drop policy if exists partner_contacts_select on partner_contacts;
drop policy if exists partner_contacts_write on partner_contacts;
create policy partner_contacts_select on partner_contacts for select
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id) and deleted_at is null);
create policy partner_contacts_insert on partner_contacts for insert
  with check (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id));
create policy partner_contacts_update on partner_contacts for update
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id))
  with check (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id));
create policy partner_contacts_delete on partner_contacts for delete
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id));

-- ---------------------------------------------------------------------------
-- Audit log of destructive actions (owner-readable; written via service role).
-- ---------------------------------------------------------------------------
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  actor_name text not null default '',
  action text not null,        -- 'deleted' | 'restored' | 'purged'
  entity_type text not null,   -- 'guest' | 'partner' | 'staff'
  entity_id uuid,
  entity_label text not null default '',
  created_at timestamptz not null default now()
);
create index audit_events_org_idx on audit_events(org_id, created_at desc);

alter table audit_events enable row level security;
-- Only the account owner can read the audit trail. Rows are inserted by server
-- actions using the service-role client (which bypasses RLS), so no insert
-- policy is needed.
create policy audit_events_select on audit_events for select
  using (org_id = current_org_id() and is_super_admin());
