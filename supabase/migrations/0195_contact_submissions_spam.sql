-- Record the spam heuristic verdict on each contact submission so flagged bot
-- traffic is still captured (durable audit trail) even though the team email and
-- CRM pipeline mirror are skipped for it. Additive, nullable/defaulted columns.
alter table contact_submissions
  add column if not exists spam_score integer not null default 0,
  add column if not exists spam_reasons text not null default '';

-- Find the flagged noise quickly when reviewing for false positives.
create index if not exists contact_submissions_spam_idx
  on contact_submissions (spam_score, created_at desc);
