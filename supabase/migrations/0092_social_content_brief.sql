-- Auto-generation of social drafts: the content brief the AI writes from (seeded
-- from the owner's Claude-project instructions) and a switch to auto-generate a
-- fresh batch when the scheduled queue runs low. Drafts always land as 'draft'
-- and only publish after the owner approves them into 'scheduled'.
alter table social_settings add column if not exists content_brief text;
alter table social_settings add column if not exists auto_generate boolean not null default false;
alter table social_settings add column if not exists content_generated_at timestamptz;

-- A tiny text fingerprint of a generated card's visible copy. It's kept even after
-- the image file is purged (3 days post-publish), so the generator can avoid
-- repeating the same graphic without storing any image files long-term.
alter table social_posts add column if not exists card_text text;
