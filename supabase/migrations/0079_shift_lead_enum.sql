-- Shift Lead: a new access role between Manager and Staff — an assistant-manager
-- tier that runs the floor (accountability, guest logging, training/tests, and
-- recovery) but not the back office (no settings, team management, growth, or
-- reporting). The enum value is added on its own so it's committed before any
-- later migration or function references it (Postgres forbids using a freshly
-- added enum value in the same transaction).
alter type access_role add value if not exists 'shift_lead';
