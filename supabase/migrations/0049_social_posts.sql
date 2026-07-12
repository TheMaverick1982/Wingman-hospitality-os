-- Social content planner (Phase 1): schedule Wingman's own marketing posts, with
-- images + captions imported from Claude Design, and get an assisted-post
-- reminder at each scheduled time. Platform-admin only (the Wingman brand), like
-- the CRM — deny-all RLS, all access via the service-role client behind the
-- requirePlatformSection("social") guard. Phase 2 (Meta Graph API auto-publish)
-- will build on this same table.

-- Public bucket: post images need a stable public URL (for display now, and for
-- Meta's Graph API, which fetches images from a public URL when publishing).
insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do nothing;

create table social_posts (
  id uuid primary key default gen_random_uuid(),
  platforms text[] not null default '{}',        -- 'instagram' | 'facebook'
  caption text not null default '',
  link text,                                      -- optional CTA link
  first_comment text,                             -- optional first comment (hashtags, etc.)
  image_paths text[] not null default '{}',       -- storage paths in the social-media bucket
  scheduled_at timestamptz,                        -- when it should go out
  status text not null default 'draft'
    check (status in ('draft','scheduled','posted','skipped')),
  posted_at timestamptz,
  reminder_sent_at timestamptz,                   -- assisted-post reminder de-dupe
  images_purged_at timestamptz,                   -- images deleted from storage to save space
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index social_posts_schedule_idx on social_posts (status, scheduled_at);

alter table social_posts enable row level security; -- deny-all: service-role only

-- Grant the new section to existing platform admins so nobody's locked out of it
-- (it's a page-backed section gated on platform_access). New teammates get it via
-- the Team page like any other section; revoke per-person there if needed.
update profiles
  set platform_access = array_append(coalesce(platform_access, '{}'), 'social')
  where is_platform_admin = true
    and not (coalesce(platform_access, '{}') @> array['social']);
