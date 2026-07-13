-- Let Shift Leads write the operational data managers can. Every operational
-- table's write policy is gated on is_manager_or_above(); adding 'shift_lead'
-- here lets them run accountability, tests, guest logging, and recovery. Finer
-- section access (they don't get growth, reporting, hiring edit, or settings) is
-- enforced in the app's permission matrix, the same way Manager access is.
create or replace function is_manager_or_above() returns boolean
  language sql stable security definer set search_path = public as $$
    select coalesce((select access_role from profiles where id = auth.uid()) in ('super_admin', 'manager', 'shift_lead'), false)
  $$;
