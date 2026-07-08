-- Location contact details, collected on add (single or bulk) from Settings.
alter table locations add column address text not null default '';
alter table locations add column phone text not null default '';
alter table locations add column email text not null default '';
