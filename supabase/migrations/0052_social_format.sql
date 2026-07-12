-- Social planner: post format (feed post / reel / story).
--
--   feed  — image/carousel/link post (the default; what everything is today)
--   reel  — Instagram Reel (video), auto-published via the API
--   story — Instagram Story; ALWAYS assisted (the API can't add a link sticker),
--           so these route to a reminder to post by hand, never auto-publish.

alter table social_posts
  add column if not exists format text not null default 'feed'
    check (format in ('feed', 'reel', 'story'));
