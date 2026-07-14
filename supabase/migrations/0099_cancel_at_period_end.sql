-- Self-serve cancellation. When an owner cancels, we mark the subscription to
-- end at the current period's close (they keep access until then, no future
-- charge). Customer-editable via the cancel/resume actions — deliberately NOT
-- in protect_org_pricing (that guards billing_status / is_free_account, which
-- only the processor webhook + platform staff may change).
alter table organizations add column cancel_at_period_end boolean not null default false;
