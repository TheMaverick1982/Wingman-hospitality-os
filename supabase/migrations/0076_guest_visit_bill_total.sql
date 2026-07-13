-- Bill total per guest visit. Lets Guest Bounce Back report the ACTUAL revenue
-- each visit generated (not an estimated average check), so the retention ROI
-- can be reported in real dollars by visit stage — first visit vs. the repeat
-- visits the bounce-back program brings back. Nullable: older visits and rows
-- without a recorded check simply don't count toward revenue.
alter table guest_visits
  add column if not exists bill_total numeric(10, 2) check (bill_total is null or bill_total >= 0);
