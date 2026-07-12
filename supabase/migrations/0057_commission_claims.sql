-- Let sales reps claim their own commissions, subject to owner approval.
--
-- A rep-submitted claim lands as 'pending'; the owner then approves it (moves it
-- to 'owed') or denies it ('denied'). Owner-entered commissions still start at
-- 'owed' directly — no self-approval needed. Extends the status check from 0056.
alter table sales_commissions drop constraint if exists sales_commissions_status_check;
alter table sales_commissions
  add constraint sales_commissions_status_check
  check (status in ('pending', 'owed', 'paid', 'void', 'denied'));
