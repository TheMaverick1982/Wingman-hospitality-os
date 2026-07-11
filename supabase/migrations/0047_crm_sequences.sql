-- Phase 1B: CRM nurture sequences (per-funnel automations).
--
-- Each lead source (demo, sales-chat, calculator, scorecard) has a sequence of
-- timed emails that nurture toward signup. A contact is enrolled when their lead
-- comes in; the /api/cron/crm-sequences cron sends due steps. Enrollment stops
-- automatically when the contact books a call (GHL webhook / manual) or becomes
-- a customer (signup), or when they unsubscribe. Platform-admin managed under
-- /admin/crm/automations. Deny-all RLS like the rest of the CRM.

create table crm_sequences (
  id uuid primary key default gen_random_uuid(),
  source text not null unique,        -- the lead source this nurtures
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table crm_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references crm_sequences(id) on delete cascade,
  step_order int not null,
  delay_days int not null default 0,  -- days after enrollment this step sends
  subject text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sequence_id, step_order)
);

create table crm_enrollments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references crm_contacts(id) on delete cascade,
  sequence_id uuid not null references crm_sequences(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','stopped')),
  stopped_reason text,                -- 'booked' | 'customer' | 'unsubscribed' | 'manual'
  next_step_order int not null default 1,
  next_run_at timestamptz not null default now(),
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, sequence_id)
);
create index crm_enrollments_due_idx on crm_enrollments (status, next_run_at);

create table crm_suppression (
  email text primary key,             -- lowercased; never email these again
  reason text,
  created_at timestamptz not null default now()
);

alter table crm_contacts
  add column if not exists booked_at timestamptz,
  add column if not exists customer_at timestamptz;

alter table crm_sequences enable row level security;      -- deny-all: service-role only
alter table crm_sequence_steps enable row level security; -- deny-all: service-role only
alter table crm_enrollments enable row level security;    -- deny-all: service-role only
alter table crm_suppression enable row level security;    -- deny-all: service-role only

-- ---------------------------------------------------------------------------
-- Seed one 60-day sequence per source (5 emails: day 0, 3, 9, 21, 45).
-- ---------------------------------------------------------------------------
insert into crm_sequences (source, name) values
  ('demo', 'Demo follow-up'),
  ('calculator', 'Calculator follow-up'),
  ('scorecard', 'Scorecard follow-up'),
  ('sales-chat', 'Sales chat follow-up');

insert into crm_sequence_steps (sequence_id, step_order, delay_days, subject, body)
select s.id, v.step_order, v.delay_days, v.subject, v.body
from crm_sequences s
join (values
  -- Demo
  ('demo', 1, 0,  'You just saw Wingman with the lights on',
   E'Thanks for taking the live demo for a spin.\n\nThat whole workspace — culture, training, and guest retention — sets up around your concept in minutes. When you''re ready to make it yours: https://www.joinwingman.app/signup\n\n— The Wingman team'),
  ('demo', 2, 3,  'The #1 thing most restaurants miss',
   E'Most operators pour money into winning new guests and quietly let the ones they''ve already won walk.\n\nWingman turns first visits into repeat visits — every shift. Here''s how it works: https://www.joinwingman.app/how-it-works'),
  ('demo', 3, 9,  'Want a hand setting it up?',
   E'Happy to walk you through Wingman on your own numbers — 30 minutes, no slides.\n\nGrab a time that works: https://www.joinwingman.app/book-a-demo'),
  ('demo', 4, 21, 'What Wingman costs',
   E'Simple, per-location pricing: $199/mo for your first location, $100/mo for each additional. Everything included, month to month.\n\nFull details: https://www.joinwingman.app/pricing'),
  ('demo', 5, 45, 'Still thinking it over?',
   E'No pressure — but the guest you already won is your best marketing channel, and every month without a retention system is money left on the table.\n\nStart whenever you''re ready: https://www.joinwingman.app/signup'),
  -- Calculator
  ('calculator', 1, 0,  'Your retention numbers',
   E'You just saw what lifting your repeat rate could add to the year.\n\nThat number isn''t hypothetical — it''s what a real system for culture, training, and follow-through delivers. See how: https://www.joinwingman.app/how-it-works'),
  ('calculator', 2, 3,  'Where that money hides',
   E'Small bumps in repeat rate and average check compound fast.\n\nWingman is built to move exactly those levers, every shift. Try it live: https://www.joinwingman.app/demo'),
  ('calculator', 3, 9,  'Want us to run your real numbers?',
   E'Book 30 minutes and we''ll map your calculator numbers to a rollout for your restaurant: https://www.joinwingman.app/book-a-demo'),
  ('calculator', 4, 21, 'Pricing',
   E'$199/mo for your first location, $100/mo each additional, month to month. It usually pays for itself in a handful of recovered guests: https://www.joinwingman.app/pricing'),
  ('calculator', 5, 45, 'The math still works',
   E'Your projection doesn''t expire — but the revenue you''re not capturing adds up every month.\n\nStart when you''re ready: https://www.joinwingman.app/signup'),
  -- Scorecard
  ('scorecard', 1, 0,  'Your scorecard + the fixes',
   E'Thanks for taking the scorecard.\n\nThe gaps it flagged are exactly what Wingman is built to close — turning standards into something your team hits every shift. See how: https://www.joinwingman.app/how-it-works'),
  ('scorecard', 2, 3,  'Closing your biggest gap',
   E'Most operators know their gaps. The hard part is holding the standard daily — which is the whole point of Wingman.\n\nTry it live: https://www.joinwingman.app/demo'),
  ('scorecard', 3, 9,  'Want to talk through your results?',
   E'Book 30 minutes and we''ll go through your scorecard and what fixing it looks like: https://www.joinwingman.app/book-a-demo'),
  ('scorecard', 4, 21, 'Simple pricing',
   E'$199/mo first location, $100/mo each additional, month to month, everything included: https://www.joinwingman.app/pricing'),
  ('scorecard', 5, 45, 'Still on your list?',
   E'Your gaps won''t close themselves — but they''re very fixable with the right system.\n\nStart when you''re ready: https://www.joinwingman.app/signup'),
  -- Sales chat
  ('sales-chat', 1, 0,  'Following up from our chat',
   E'Thanks for chatting with us on the site.\n\nIf any questions are still open, just reply — happy to help. Want to see it for real? https://www.joinwingman.app/demo'),
  ('sales-chat', 2, 3,  'How Wingman works',
   E'The short version: Wingman turns first-time guests into regulars with the culture, training, and accountability your team uses every shift.\n\nMore here: https://www.joinwingman.app/how-it-works'),
  ('sales-chat', 3, 9,  'Prefer to talk to a person?',
   E'Grab 30 minutes and we''ll tailor it to your restaurant: https://www.joinwingman.app/book-a-demo'),
  ('sales-chat', 4, 21, 'What it costs',
   E'$199/mo first location, $100/mo each additional, month to month: https://www.joinwingman.app/pricing'),
  ('sales-chat', 5, 45, 'Ready when you are',
   E'No rush — whenever you want to set your standard, it takes minutes to start: https://www.joinwingman.app/signup')
) as v(source, step_order, delay_days, subject, body) on v.source = s.source;

-- Greet every seeded email by first name. {{first_name}} is replaced at send
-- time with the recipient's safe first name (or "there" if missing/filtered).
update crm_sequence_steps set body = 'Hi {{first_name}},' || E'\n\n' || body;
