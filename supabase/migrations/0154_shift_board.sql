-- Shift Hub, Slice 1: the shift board. Managers/shift-leads post the day's
-- 86'd items, staffing changes ("who's off the schedule" — never the reason),
-- and shift notes; all staff at that location see them, and each day archives on
-- its own so the board stays fresh. business_day is the local calendar day at
-- the location (see src/lib/local-date.ts).
create table shift_board_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  author_name text not null default '',
  kind text not null default 'note',   -- 'eightysix' | 'staffing' | 'note'
  body text not null,
  business_day date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz               -- soft delete only
);
create index shift_board_notes_loc_day_idx on shift_board_notes(location_id, business_day, created_at desc);
create index shift_board_notes_org_day_idx on shift_board_notes(org_id, business_day desc);

alter table shift_board_notes enable row level security;
-- Everyone in the org reads their team's board.
create policy shift_board_select on shift_board_notes for select
  using (org_id = current_org_id());
-- Only managers/shift-leads post or edit (is_manager_or_above covers both).
create policy shift_board_write on shift_board_notes for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());
