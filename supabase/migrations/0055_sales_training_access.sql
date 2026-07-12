-- Sales Training is a static, code-maintained platform-admin section (loose demo
-- scripts and guidance for staff who run demos). It has no tables of its own —
-- it's gated purely on platform_access. Grant it to existing platform admins so
-- nobody's locked out; new teammates get it via the Team page like any other
-- section, and it can be revoked per-person there.
update profiles
  set platform_access = array_append(coalesce(platform_access, '{}'), 'sales_training')
  where is_platform_admin = true
    and not (coalesce(platform_access, '{}') @> array['sales_training']);
