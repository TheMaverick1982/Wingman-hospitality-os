-- Lets the account owner (Super Admin) customize the Manager/Staff access
-- level per section from Settings, instead of the fixed default matrix.
-- Super Admin's own access is never overridable (always full) -- this
-- column only affects app-layer nav/page gating; the underlying RLS
-- policies and server actions for Settings/billing-sensitive operations
-- independently require is_super_admin() regardless of this matrix.
alter table organizations add column permission_overrides jsonb not null default '{}'::jsonb;
