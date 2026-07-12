-- Sales commission ledger. Tracks what each demo/sales rep is owed and what's
-- been paid, so both the rep and the owner see the same numbers. Managed by
-- platform staff; deny-all RLS like the rest of the platform tables (all access
-- goes through the service-role admin client, which scopes reps to their own
-- rows in the app layer).
--
-- Entries are recorded by an admin today (billing isn't connected yet, so
-- activation bonuses and the monthly 5% tail can't auto-accrue). The status
-- flow is owed -> paid, with void for clawbacks (e.g. an account that cancels
-- inside 90 days).

create table sales_commissions (
  id uuid primary key default gen_random_uuid(),
  rep_profile_id uuid not null references profiles(id) on delete cascade,  -- the salesperson
  org_id uuid references organizations(id) on delete set null,             -- the account it's for (context)
  kind text not null check (kind in ('activation', 'tail', 'other')),
  label text not null,                                                     -- e.g. "Activation — Joe's Diner"
  amount_cents int not null check (amount_cents >= 0),
  status text not null default 'owed' check (status in ('owed', 'paid', 'void')),
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table sales_commissions enable row level security; -- deny-all: service-role only

create index sales_commissions_rep_idx on sales_commissions (rep_profile_id);
create index sales_commissions_status_idx on sales_commissions (status);

-- Grant the new "Sales Commissions" section to existing full-access platform
-- admins (owners) so it shows up. Demo reps don't get the admin ledger — they
-- see their own earnings inside the Sales Training section instead. New
-- teammates get sections via the Team page like anything else.
update profiles
  set platform_access = array_append(coalesce(platform_access, '{}'), 'commissions')
  where is_platform_admin = true
    and 'organizations' = any(coalesce(platform_access, '{}'))
    and not (coalesce(platform_access, '{}') @> array['commissions']);
