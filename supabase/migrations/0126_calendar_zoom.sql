-- Zoom video integration. Zoom is a video provider (not a calendar): a rep
-- connects Zoom once, and meetings hosted on a calendar that can't mint a Google
-- Meet link (i.e. Outlook) get a Zoom join link instead. One Zoom account per rep.
--
-- Tokens are SECRETS: deny-all RLS (enabled, no policies), service-role only.
create table if not exists calendar_zoom_accounts (
  user_id uuid primary key references profiles(id) on delete cascade,
  zoom_user_id text not null default '',
  email text not null default '',
  access_token text not null default '',
  refresh_token text not null default '',
  token_expires_at timestamptz,
  scopes text not null default '',
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table calendar_zoom_accounts enable row level security;  -- deny-all: service-role only

-- Per-rep video preference. 'auto' = Google Meet when the meeting is hosted on a
-- Google calendar, else Zoom. 'google_meet' = always host on Google for a Meet
-- link. 'zoom' = always use Zoom (works with any calendar). Google Meet requires
-- the event to be on Google — that's a Google limitation, not ours.
alter table calendar_settings add column if not exists video_provider text not null default 'auto';
