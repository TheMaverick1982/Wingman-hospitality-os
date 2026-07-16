-- The Playbook phase 2: an approval gate for scheduled posts. AI-generated posts
-- are scheduled but NOT approved; the owner reviews and approves each, and only
-- approved + scheduled posts whose time has arrived are auto-published (and
-- posted to Facebook) by the cron.

alter table blog_posts add column if not exists approved boolean not null default false;
