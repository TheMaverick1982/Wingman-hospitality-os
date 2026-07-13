-- Testing / exams inside Training. A test is built and configured like the other
-- sections (AI build or paste-and-improve), broken into "days" (sequential
-- modules a fast learner can blow through in one sitting, or spread over the
-- allowed window), each day holding optional study/teaching content followed by
-- auto-scored multiple-choice / true-false questions.
--
-- Phase 1 covers the build tables (definition, days, questions). Assignment and
-- attempt tracking land in a later migration.

create table tests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  -- 'exam' = questions only; 'study_quiz' = teach first (LTO/menu), then quiz.
  mode text not null default 'exam' check (mode in ('exam', 'study_quiz')),
  -- Which roles must take it. Empty = everyone; else specific department names.
  target_departments text[] not null default '{}',
  day_count smallint not null default 1 check (day_count between 1 and 30),
  pass_pct smallint not null default 80 check (pass_pct between 1 and 100),
  -- How many retakes after the first attempt (0 = one shot). After they're used
  -- up the assignment locks and needs a manager to manually unlock.
  max_retakes smallint not null default 1 check (max_retakes between 0 and 10),
  -- Completion window; null = no deadline.
  complete_within_amount integer check (complete_within_amount is null or complete_within_amount > 0),
  complete_within_unit text not null default 'days' check (complete_within_unit in ('hours', 'days')),
  -- A menu/LTO test that rotates monthly and gets pushed to all staff.
  rotates_monthly boolean not null default false,
  source text not null default 'ai' check (source in ('ai', 'upload', 'training', 'example')),
  active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tests_org_idx on tests (org_id, created_at desc);

create table test_days (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  day_number smallint not null check (day_number between 1 and 30),
  title text not null default '',
  content text not null default '', -- teaching / study material shown before the day's questions
  unique (test_id, day_number)
);
create index test_days_test_idx on test_days (test_id, day_number);

create table test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  day_number smallint not null default 1 check (day_number between 1 and 30),
  sort_order smallint not null default 0,
  kind text not null default 'multiple_choice' check (kind in ('multiple_choice', 'true_false')),
  prompt text not null,
  options text[] not null default '{}', -- multiple_choice answer options; true_false uses {True,False}
  correct_index smallint not null default 0 check (correct_index >= 0),
  explanation text not null default ''
);
create index test_questions_test_idx on test_questions (test_id, day_number, sort_order);

alter table tests enable row level security;
alter table test_days enable row level security;
alter table test_questions enable row level security;

-- Everyone in the org can read tests (staff need to take them); managers+ build.
create policy tests_select on tests for select using (org_id = current_org_id());
create policy tests_write on tests for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());

create policy test_days_select on test_days for select using (org_id = current_org_id());
create policy test_days_write on test_days for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());

-- Question rows carry the correct answer, so staff SELECT is intentionally NOT
-- granted here — the take-the-test flow (later phase) reads them via a
-- service-role path that strips the answer. Managers+ read/write for building.
create policy test_questions_write on test_questions for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());
