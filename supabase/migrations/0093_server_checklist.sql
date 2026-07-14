-- Server standards checklist. Reuses the accountability checklist model: an
-- editable per-org template ('server' type) plus per-server completions in
-- shift_checklist_completions (whose checklist_type is free text, so no change
-- is needed there). Only the checklist-item template's type constraint needs to
-- learn the new value.
alter table accountability_checklist_items
  drop constraint if exists accountability_checklist_items_checklist_type_check;
alter table accountability_checklist_items
  add constraint accountability_checklist_items_checklist_type_check
  check (checklist_type in ('daily', 'preshift', 'loyalty', 'server'));
