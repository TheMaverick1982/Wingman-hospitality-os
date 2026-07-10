-- Extend the org-pricing guard to also protect the billing-state columns.
--
-- Customers (Super Admins) can update their own organization row, so — just like
-- the custom pricing columns — they must not be able to flip their own
-- is_free_account or billing_status through the API to dodge billing. Only
-- out-of-band writes (service-role: the payments webhook and admin actions,
-- where auth.uid() is null) may change these.

create or replace function protect_org_pricing() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if auth.uid() is not null
     and (new.custom_monthly_cents is distinct from old.custom_monthly_cents
       or new.custom_addl_location_cents is distinct from old.custom_addl_location_cents
       or new.is_free_account is distinct from old.is_free_account
       or new.billing_status is distinct from old.billing_status) then
    raise exception 'Billing and pricing can only be changed by platform staff';
  end if;
  return new;
end;
$$;
