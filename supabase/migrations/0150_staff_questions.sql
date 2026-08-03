-- Staff → manager escalation for the Ask Wingman assistant (Phase 2).
--
-- When the assistant can't answer from the restaurant's own content, a staff
-- member can escalate the question to their managers. Managers are alerted
-- (push + email), answer in-app, and can save the answer into the Team Playbook
-- so the assistant handles it automatically next time.
create table staff_questions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  asked_by uuid references profiles(id) on delete set null,
  asked_by_name text not null default '',
  -- The asker's auth email, captured at ask time (profiles has no email column;
  -- it lives in auth.users), so we can email them the answer without an admin
  -- auth lookup.
  asked_by_email text,
  question text not null,
  status text not null default 'open',        -- 'open' | 'answered'
  answer text,
  answered_by uuid references profiles(id) on delete set null,
  answered_by_name text,
  answered_at timestamptz,
  saved_to_playbook boolean not null default false,
  -- Set true once the asker has seen the answer (drives their "answered" view).
  seen_by_asker boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft delete only — never hard-delete client data.
  deleted_at timestamptz
);

create index staff_questions_org_idx on staff_questions(org_id, status, created_at desc);
create index staff_questions_asker_idx on staff_questions(asked_by, created_at desc);

alter table staff_questions enable row level security;

-- Reads: the asker sees their own questions; managers/owners see every question
-- in their org. All writes happen through server actions on the service-role
-- client (which enforce role in app code), so no write policy is needed here.
create policy staff_questions_select on staff_questions for select
  using (
    org_id = current_org_id()
    and (asked_by = auth.uid() or is_manager_or_above())
  );
