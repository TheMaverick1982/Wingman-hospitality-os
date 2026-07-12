-- Add a "Delete CRM contacts" capability so a teammate can have CRM access to
-- view / add / edit contacts without being able to permanently delete them
-- (used by the new "Sales agent" preset). deleteContact now requires this.
--
-- Preserve current behavior: grant crm_delete to every existing platform admin
-- who already has CRM access, so no one loses the ability they have today. New
-- sales agents simply don't get it.
update profiles
  set platform_access = array_append(coalesce(platform_access, '{}'), 'crm_delete')
  where is_platform_admin = true
    and 'crm' = any(coalesce(platform_access, '{}'))
    and not (coalesce(platform_access, '{}') @> array['crm_delete']);
