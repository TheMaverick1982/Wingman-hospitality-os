-- Guest review -> shout-out bridge: when a manager turns a guest review that
-- named a server into a Wins-feed recognition, stamp the response so the button
-- shows "Recognized" and we don't double-post. Additive.
alter table guest_survey_responses add column if not exists recognized_at timestamptz;
