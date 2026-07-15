-- Sales rep certification test. Reps review the sales playbook, then take an
-- AI-generated quiz + roleplay drawn from the CURRENT playbook content. A version
-- is keyed to a hash of the playbook, so when the training content changes a new
-- version is generated automatically and old attempts are marked against the
-- version they were taken on.
--
-- All platform-staff data. Deny-all RLS (service-role only); every read/write
-- goes through platform-gated server code.

create table if not exists sales_cert_versions (
  id uuid primary key default gen_random_uuid(),
  content_hash text not null unique,
  question_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists sales_cert_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references sales_cert_versions(id) on delete cascade,
  section text not null default 'General',
  kind text not null default 'mcq',          -- 'mcq' | 'roleplay'
  prompt text not null,
  options jsonb not null default '[]'::jsonb, -- mcq choices
  correct_index integer,                      -- mcq answer
  explanation text not null default '',
  sort_order integer not null default 0
);

create table if not exists sales_cert_attempts (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references sales_cert_versions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score_pct integer,
  section_scores jsonb,                        -- { section: pct }
  passed boolean
);

create table if not exists sales_cert_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references sales_cert_attempts(id) on delete cascade,
  question_id uuid not null references sales_cert_questions(id) on delete cascade,
  kind text not null,
  section text not null default 'General',
  selected_index integer,                      -- mcq
  response_text text,                          -- roleplay
  correct boolean,
  ai_score integer,                            -- roleplay 0-100
  ai_feedback text
);

create index if not exists sales_cert_questions_version_idx on sales_cert_questions(version_id);
create index if not exists sales_cert_attempts_user_idx on sales_cert_attempts(user_id);
create index if not exists sales_cert_answers_attempt_idx on sales_cert_answers(attempt_id);

alter table sales_cert_versions enable row level security;
alter table sales_cert_questions enable row level security;
alter table sales_cert_attempts enable row level security;
alter table sales_cert_answers enable row level security;
