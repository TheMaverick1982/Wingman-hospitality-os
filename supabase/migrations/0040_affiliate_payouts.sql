-- Affiliate program — Phase 3 (payouts).
--
-- One row per payout attempt to an affiliate's PayPal. When a payout is
-- submitted, the affiliate's approved commissions are stamped with payout_id and
-- flipped to "paid". A status sync reconciles against PayPal; a failed/returned
-- payout reverts those commissions to "approved".

create table affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount_cents int not null,
  paypal_email text not null,
  status text not null default 'processing' check (status in ('processing', 'success', 'failed')),
  paypal_batch_id text,
  error text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index affiliate_payouts_aff_idx on affiliate_payouts(affiliate_id, created_at desc);

alter table affiliate_payouts enable row level security;

-- Affiliates can see their own payout history; all writes go through server code.
create policy affiliate_payouts_select_self on affiliate_payouts for select
  using (affiliate_id in (select id from affiliates where user_id = auth.uid()));
