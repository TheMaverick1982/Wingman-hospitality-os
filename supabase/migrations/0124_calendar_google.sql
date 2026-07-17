-- Calendar Phase 1: Google Calendar connect + availability + booking + Meet.
--
-- Each platform staffer (salesperson) can connect up to TWO Google accounts, set
-- their weekly availability + time zone, and publish a personal booking page.
-- Prospects self-book a meeting that lands on the rep's calendar with a Google
-- Meet link, and receive an email confirmation with an .ics attachment.
--
-- Tokens are SECRETS. All three tables are deny-all under RLS (enabled, no
-- policies): the anon/authenticated client can't read them at all. Every read and
-- write goes through the service-role client in gated server code. The public
-- booking page is rendered server-side via the service-role client, which only
-- ever exposes non-secret fields (never a token) to the browser.

-- Connected Google accounts (up to two per user). One row per (user, Google sub).
create table if not exists calendar_google_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  google_sub text not null,                    -- OpenID `sub` — stable Google account id
  email text not null default '',
  access_token text not null default '',
  refresh_token text not null default '',
  token_expires_at timestamptz,
  scopes text not null default '',
  calendar_id text not null default 'primary', -- the calendar events are written to
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, google_sub)                 -- same account can't double-connect (reconnect updates)
);
create index if not exists calendar_google_accounts_user_idx on calendar_google_accounts (user_id);

alter table calendar_google_accounts enable row level security;  -- deny-all: service-role only

-- Per-salesperson booking configuration (one row per user).
create table if not exists calendar_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  slug text not null unique,                    -- public booking page URL segment
  time_zone text not null default 'America/New_York',
  meeting_duration_minutes integer not null default 30,
  buffer_minutes integer not null default 0,    -- padding kept free after each meeting
  advance_notice_hours integer not null default 12,  -- earliest bookable lead time
  booking_window_days integer not null default 21,   -- how far out the page opens
  -- Weekly rules in the host's time zone, e.g.
  --   [{ "weekday": 1, "start": "09:00", "end": "17:00" }, ...]  (0 = Sunday)
  availability jsonb not null default '[]',
  page_title text not null default '',
  page_description text not null default '',
  is_active boolean not null default false,     -- booking page live only when true
  -- When true, this rep's connected calendars feed the shared, round-robin
  -- /book-a-demo pool (see calendar_demo_pool). Multiple reps can opt in; a demo
  -- time is offered if ANY pooled rep is free, and each booking is assigned to a
  -- free rep round-robin (least-loaded first).
  in_demo_pool boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendar_settings_demo_pool_idx on calendar_settings (in_demo_pool) where in_demo_pool;

alter table calendar_settings enable row level security;  -- deny-all: service-role only

-- Shared configuration for the public, round-robin /book-a-demo page (a singleton
-- row). It defines the demo's duration, working hours, and booking window; the
-- reps in the pool (calendar_settings.in_demo_pool) supply free/busy and receive
-- the round-robin bookings. Replaces the old GoHighLevel embed.
create table if not exists calendar_demo_pool (
  id boolean primary key default true check (id),  -- single row only (id is always true)
  time_zone text not null default 'America/New_York',
  meeting_duration_minutes integer not null default 30,
  buffer_minutes integer not null default 0,
  advance_notice_hours integer not null default 12,
  booking_window_days integer not null default 21,
  availability jsonb not null default '[]',
  page_title text not null default 'Book a demo',
  page_description text not null default '',
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table calendar_demo_pool enable row level security;  -- deny-all: service-role only

-- Booked meetings (the local record; the source of truth is the Google event).
create table if not exists calendar_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  google_account_id uuid references calendar_google_accounts(id) on delete set null,
  google_event_id text not null default '',
  meet_link text not null default '',
  html_link text not null default '',           -- Google Calendar event URL (for the host)
  invitee_name text not null default '',
  invitee_email text not null default '',
  invitee_notes text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  time_zone text not null default '',           -- the invitee's chosen time zone
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  -- Opaque token for the public self-serve manage/cancel page (no login).
  manage_token text not null default '',
  -- Where to send the guest to rebook after cancelling (e.g. /book/<slug> or
  -- /book-a-demo).
  rebook_path text not null default '/book-a-demo',
  -- Which reminder emails have already gone out ('24h', '1h') — keeps the hourly
  -- cron from re-sending.
  reminders_sent text[] not null default '{}',
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists calendar_bookings_user_idx on calendar_bookings (user_id, start_at desc);
create index if not exists calendar_bookings_reminders_idx on calendar_bookings (status, start_at) where status = 'confirmed';
create unique index if not exists calendar_bookings_manage_token_idx on calendar_bookings (manage_token) where manage_token <> '';

alter table calendar_bookings enable row level security;  -- deny-all: service-role only
