-- Optional accounting/billing email for an organization. Receipts and invoices
-- are sent here in addition to the account owner(s). Customer-editable: it is
-- deliberately NOT in the protect_org_pricing guard (unlike billing_status /
-- is_free_account), so an org's Super Admin can set it from Settings.
alter table organizations add column billing_email text;
