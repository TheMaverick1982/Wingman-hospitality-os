-- Affiliate program — Phase 2 (commission ledger).
--
-- One row per referred org per month it pays. A commission starts "pending" and
-- becomes "approved" (payable) once the customer makes their NEXT successful
-- payment (i.e. their 2nd payment clears the 1st), which is how the hold works.
-- Refund/cancel voids anything still pending. Payouts (Phase 3) flip approved
-- rows to "paid" and stamp payout_id.

create table affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  org_id uuid references organizations(id) on delete set null,
  period_month date not null,                 -- first day of the paid month
  amount_cents int not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'void')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  payout_id uuid,                             -- set in Phase 3 when paid out
  unique (org_id, period_month)               -- at most one accrual per org per month (idempotent)
);
create index affiliate_commissions_aff_idx on affiliate_commissions(affiliate_id, status);
create index affiliate_commissions_org_idx on affiliate_commissions(org_id);

alter table affiliate_commissions enable row level security;

-- Affiliates can read their own commissions. All writes go through server code
-- using the service-role client.
create policy affiliate_commissions_select_self on affiliate_commissions for select
  using (affiliate_id in (select id from affiliates where user_id = auth.uid()));
