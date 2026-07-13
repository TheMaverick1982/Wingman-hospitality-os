-- Add more common restaurant roles so the Setup Wizard, Training, and Hiring
-- cover more than the original five. app_department is an enum used across ~9
-- tables, so we extend it in place (values can't be removed, but these are all
-- broadly useful). Safe to re-run.
alter type app_department add value if not exists 'Busser';
alter type app_department add value if not exists 'Food Runner';
alter type app_department add value if not exists 'Barista';
alter type app_department add value if not exists 'Line Cook';
alter type app_department add value if not exists 'Dishwasher';
alter type app_department add value if not exists 'Expo';
alter type app_department add value if not exists 'Sommelier';
