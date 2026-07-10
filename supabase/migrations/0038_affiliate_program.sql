-- Affiliate program — Phase 1 (foundation).
--
-- A separate surface from the client app and platform admin: affiliates apply
-- publicly, are approved by platform staff, get a unique referral link, and see
-- their own dashboard. Attribution is first-click with a configurable window;
-- when a referred prospect signs up, the new org is stamped with the affiliate.
--
-- Commission accrual + PayPal payouts come in later phases; this migration lays
-- down the data model, referral tracking, and the admin "affiliates" section.

-- Program-wide defaults (single row). Per-affiliate values can override some.
create table affiliate_program_settings (
  id int primary key default 1 check (id = 1),
  default_commission_pct numeric not null default 20,   -- % of subscription
  default_term_months int not null default 12,          -- how many months commission is paid
  default_cookie_days int not null default 60,           -- attribution window
  min_payout_cents int not null default 5000,            -- $50 minimum payout
  updated_at timestamptz not null default now()
);
insert into affiliate_program_settings (id) values (1) on conflict (id) do nothing;

-- An affiliate. Tied to an auth user once approved (invited to set a password).
create table affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  full_name text not null default '',
  code text unique,                                       -- referral code, assigned on approval
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  commission_pct numeric,                                 -- null = use program default
  cookie_days int,                                        -- null = use program default
  paypal_email text,
  promo_method text,                                      -- how they plan to promote (from application)
  agreement_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index affiliates_status_idx on affiliates(status, created_at desc);

-- Raw referral-link clicks, for the affiliate's stats.
create table affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referrer text,
  created_at timestamptz not null default now()
);
create index affiliate_clicks_aff_idx on affiliate_clicks(affiliate_id, created_at desc);

-- A referred signup: the affiliate credited for an organization. One org can be
-- attributed to at most one affiliate (first-click wins, enforced in code).
create table affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  org_id uuid unique references organizations(id) on delete set null,
  created_at timestamptz not null default now()
);
create index affiliate_referrals_aff_idx on affiliate_referrals(affiliate_id, created_at desc);

-- Attribution stamp on the organization itself (survives cookie clearing).
alter table organizations add column if not exists referred_by_affiliate_id uuid references affiliates(id) on delete set null;

alter table affiliate_program_settings enable row level security;
alter table affiliates enable row level security;
alter table affiliate_clicks enable row level security;
alter table affiliate_referrals enable row level security;

-- Affiliates can read their own row and their own stats. All writes (apply,
-- approve, click logging, attribution) go through server code using the
-- service-role client, which bypasses RLS — so no public insert/update policies.
create policy affiliates_select_self on affiliates for select
  using (user_id = auth.uid());

create policy affiliate_clicks_select_self on affiliate_clicks for select
  using (affiliate_id in (select id from affiliates where user_id = auth.uid()));

create policy affiliate_referrals_select_self on affiliate_referrals for select
  using (affiliate_id in (select id from affiliates where user_id = auth.uid()));

-- Give existing full-access platform admins the new "affiliates" section so the
-- owner sees it immediately (mirrors how client_login was backfilled).
update profiles
  set platform_access = array_append(platform_access, 'affiliates')
  where is_platform_admin = true
    and 'organizations' = any(platform_access)
    and not ('affiliates' = any(platform_access));
