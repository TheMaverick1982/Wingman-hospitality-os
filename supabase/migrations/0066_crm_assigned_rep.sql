-- Assign CRM contacts to a sales rep, so each rep can see their own pipeline
-- metrics (leads / demos / won / lost) and owners can see everyone's. A rep is a
-- platform-staff profile; nulling on delete keeps history if a rep leaves.
alter table crm_contacts add column if not exists assigned_rep_id uuid references profiles(id) on delete set null;
create index if not exists crm_contacts_assigned_rep_idx on crm_contacts (assigned_rep_id);

-- New "Sales Dashboard" platform section — grant it to existing owner admins so
-- it shows up; new sales agents get it via the Team preset. Reps only ever see
-- their own numbers (scoped in the app by assigned_rep_id); the admin all-reps
-- view is gated separately on the commissions section.
update profiles
  set platform_access = array_append(coalesce(platform_access, '{}'), 'sales_dashboard')
  where is_platform_admin = true
    and 'organizations' = any(coalesce(platform_access, '{}'))
    and not (coalesce(platform_access, '{}') @> array['sales_dashboard']);
