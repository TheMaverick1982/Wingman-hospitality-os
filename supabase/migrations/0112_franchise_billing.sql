-- Franchise Phase 3: group billing.
--
-- Two modes (franchise_groups.billing_mode):
--   * distributed — each franchisee pays their own card (works already; the
--     franchisor just gains billing VISIBILITY across everyone).
--   * central — the franchisor pays for all: member orgs are NOT charged
--     individually (billed_by_group = true → the per-org charge cron skips them),
--     and one rolled-up charge (the sum of every member's effective monthly
--     price) is billed to the group's card, held on the group owner's org.
--
-- billed_by_group is maintained by the membership / billing-mode admin actions.

alter table organizations add column if not exists billed_by_group boolean not null default false;
