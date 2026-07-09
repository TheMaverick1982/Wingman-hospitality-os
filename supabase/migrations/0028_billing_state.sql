-- Processor-agnostic billing state.
--
-- The payment processor (Global Payments / Genius, Stripe, etc.) is wired in
-- later via a webhook that flips these columns; ALL of the dunning and
-- notification logic reads from here, so switching or connecting a processor
-- doesn't touch the reminder/closure engine.
--
--   billing_status:  free   -- no charging (default; today's accounts)
--                    active -- paid and current
--                    past_due -- a charge failed; in the 30-day dunning window
--                    canceled -- closed (by the customer or for non-payment)

alter table organizations
  add column if not exists billing_status text not null default 'free',
  add column if not exists payment_provider text,
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists card_brand text,
  add column if not exists card_last4 text,
  add column if not exists current_period_end timestamptz,
  add column if not exists payment_failed_at timestamptz,        -- start of the current dunning cycle
  add column if not exists dunning_last_notified_at timestamptz; -- last customer nudge sent

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_billing_status_check') then
    alter table organizations
      add constraint organizations_billing_status_check
      check (billing_status in ('free', 'active', 'past_due', 'canceled'));
  end if;
end $$;
