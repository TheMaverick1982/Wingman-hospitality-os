-- Coupon codes: one-time discounts, recurring discounts, and free trials.
--
-- Trials take effect immediately (they hold an account free until they end).
-- Dollar/percent discounts are recorded on redemption and applied by the
-- billing engine once a payment processor is connected (accounts are 'free'
-- today, so there's nothing to charge yet). Platform-admin managed; deny-all
-- RLS like the rest of the platform tables.

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- normalized uppercase
  description text,
  kind text not null check (kind in ('one_time', 'recurring', 'trial')),
  percent_off int check (percent_off between 1 and 100),      -- discount: % off
  amount_off_cents int check (amount_off_cents > 0),          -- or a flat $ off
  duration_months int check (duration_months > 0),            -- recurring: months (null = forever)
  trial_days int check (trial_days between 1 and 365),        -- trial: length
  max_redemptions int check (max_redemptions > 0),            -- null = unlimited
  redeemed_count int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table coupons enable row level security; -- deny-all: service-role only

-- One redemption per org (a fresh redeem replaces the org's coupon). Carries a
-- snapshot of the coupon terms so later edits/deletes don't change what an org got.
create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  kind text not null,
  percent_off int,
  amount_off_cents int,
  duration_months int,
  trial_days int,
  source text not null default 'admin',            -- 'signup' | 'admin'
  redeemed_at timestamptz not null default now(),
  unique (org_id)
);
alter table coupon_redemptions enable row level security; -- deny-all: service-role only

-- Quick-read fields on the org (for display + trial gating). Protected like the
-- pricing columns so customers can't self-edit them.
alter table organizations
  add column if not exists coupon_code text,
  add column if not exists trial_ends_at timestamptz;

-- Protect coupon_code + trial_ends_at from customer self-edit, alongside the
-- pricing columns (extends the guard from 0042). Only service-role/admin writes
-- (auth.uid() is null) may change them.
create or replace function protect_org_pricing() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if auth.uid() is not null
     and (new.custom_monthly_cents is distinct from old.custom_monthly_cents
       or new.custom_addl_location_cents is distinct from old.custom_addl_location_cents
       or new.coupon_code is distinct from old.coupon_code
       or new.trial_ends_at is distinct from old.trial_ends_at) then
    raise exception 'Pricing and coupons can only be changed by platform staff';
  end if;
  return new;
end;
$$;

-- Grant the new "Coupons" section to existing platform admins so it shows up.
update profiles
  set platform_access = array_append(coalesce(platform_access, '{}'), 'coupons')
  where is_platform_admin = true
    and not (coalesce(platform_access, '{}') @> array['coupons']);
