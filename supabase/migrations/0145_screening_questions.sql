-- AI-graded pre-interview screening on the public application form.
--
-- Per-role screening questions (AI-generated, owner-editable — same source model
-- as hiring_traits), plus the candidate's answers and an AI grade stored on each
-- application so a manager can decide whether to schedule an interview.

create table if not exists screening_questions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  department app_department not null,
  prompt text not null,
  -- Which signal this question probes. 'hospitality' = guest-experience instinct;
  -- 'follows_instructions' = the question embeds an explicit instruction so the
  -- answer itself shows whether they follow direction.
  axis text not null default 'hospitality',
  sort_order int not null default 0,
  -- 'wingman' = AI-generated (regenerating replaces only these); 'custom' = owner
  -- added or edited.
  source text not null default 'wingman',
  created_at timestamptz not null default now()
);
create index if not exists screening_questions_org_dept_idx on screening_questions(org_id, department, sort_order);

alter table screening_questions enable row level security;
create policy screening_questions_select on screening_questions for select using (org_id = current_org_id());
create policy screening_questions_write on screening_questions for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());

-- The candidate's answers (array of {id, prompt, axis, value}) and the AI grade
-- (two axes + rationale + tier), attached to the application. Additive and
-- nullable so a lagging migration never blocks a public submission.
alter table job_applications add column if not exists screening_answers jsonb;
alter table job_applications add column if not exists screening_grade jsonb;
