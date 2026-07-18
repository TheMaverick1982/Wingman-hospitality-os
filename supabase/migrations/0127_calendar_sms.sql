-- Twilio SMS for bookings. Store the invitee's phone (optional) so we can text a
-- confirmation and reminders. SMS is sent only when Twilio is configured and the
-- invitee provided a phone; the reminder cron tracks SMS sends in reminders_sent
-- ('sms24h' / 'sms1h') alongside the email keys.
alter table calendar_bookings add column if not exists invitee_phone text not null default '';
