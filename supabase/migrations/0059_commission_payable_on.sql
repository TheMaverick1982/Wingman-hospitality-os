-- Give each commission an expected pay date, so the owner gets a "due to pay
-- now" prompt and the rep can see when to expect their money.
--
-- Per policy, a commission is payable after the account clears its first paid
-- month — roughly a month out — so entries default to ~30 days from when they're
-- recorded, and the owner can adjust the date on any line. Backfill existing
-- rows the same way.
alter table sales_commissions add column if not exists payable_on date;

update sales_commissions
  set payable_on = (created_at::date + interval '30 days')::date
  where payable_on is null;
