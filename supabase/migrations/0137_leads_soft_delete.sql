-- Soft-delete for marketing leads. Deleting a lead from the admin Leads table
-- stamps deleted_at instead of removing the row, so nothing is destroyed and the
-- capture can be recovered if needed. Leads are platform-level (no org_id), so
-- they live outside the per-org Trash — the column alone makes the delete
-- reversible. Reads filter deleted_at IS NULL; all access is via the service-role
-- client (the table is deny-all under RLS).

alter table leads add column if not exists deleted_at timestamptz;
create index if not exists leads_active_created_idx on leads(created_at desc) where deleted_at is null;
