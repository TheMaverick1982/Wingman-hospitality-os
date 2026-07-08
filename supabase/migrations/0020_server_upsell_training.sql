-- Adds explicit Server training coverage for upselling through pairings --
-- not just per-dish pairing/upsell suggestions on individual menu items
-- (already covered by menu_items.pairing_suggestion/upsell_suggestion), but
-- the general skill of recommending pairings and add-ons for any table.
insert into department_training_items (org_id, department, item, sort_order)
select o.id, 'Server', v.item, v.sort_order
from organizations o
cross join (values
  ('Suggest a specific pairing — a wine, side, or sauce — with every entrée recommendation', 5),
  ('Have one ready-to-go upsell pairing for each of the top-selling dishes', 6),
  ('Offer a dessert or appetizer pairing before the check is dropped', 7)
) as v(item, sort_order)
where not exists (
  select 1 from department_training_items dti
  where dti.org_id = o.id and dti.department = 'Server' and dti.item = v.item
);

-- Re-seed create_organization() so new orgs get this by default too.
create or replace function create_organization(org_name text, gm_full_name text, first_location_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  new_location_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'User already belongs to an organization';
  end if;

  insert into organizations (name) values (org_name) returning id into new_org_id;
  insert into locations (org_id, name) values (new_org_id, first_location_name) returning id into new_location_id;
  insert into profiles (id, org_id, full_name, access_role, location_id)
    values (auth.uid(), new_org_id, gm_full_name, 'super_admin', null);

  insert into core_values (org_id, title, description, hiring_question, hiring_green_flag, hiring_red_flag, sort_order) values
    (new_org_id, 'We create reactions, not transactions', 'Guests don''t return because of what they bought. They return because of how they felt.', 'Tell me about a time you made a customer or client feel genuinely special.', 'Describes reading the person and adjusting in the moment.', 'Describes following a script or company policy.', 0),
    (new_org_id, 'Recognition drives loyalty', 'A returning guest should never feel like a new guest.', 'How would you make a repeat customer feel different from a first-timer?', 'Specific ideas: names, preferences, small callbacks.', 'Treats every customer identically, no mention of familiarity.', 1),
    (new_org_id, 'Personalization over standardization', 'Read the guest. Adjust tone and pacing. Never sound scripted.', 'How would you handle two very different customers back to back?', 'Naturally shifts tone and pacing between the two.', 'Gives the same approach for both examples.', 2),
    (new_org_id, 'Every role owns the experience', 'Hospitality isn''t one position''s job. Host, server, bartender, chef, manager — all in.', 'Tell me about a time something wasn''t your job, but you helped anyway.', 'Jumps in without being asked, no "not my role" framing.', 'Waits to be told, or frames helping as an inconvenience.', 3),
    (new_org_id, 'The details define the brand', 'Speed of greeting, cleanliness, timing, eye contact. Small things, big impression.', 'What did you notice the last time you got great service somewhere?', 'Specific small details — timing, greeting, cleanliness.', 'Vague answer ("it was nice"), nothing concrete.', 4);

  insert into department_standards (org_id, department, item, sort_order)
  select new_org_id, d.department, d.item, d.sort_order
  from (values
    ('Host'::app_department, 'Greet every guest immediately — smile, eye contact, drop what you''re doing', 0),
    ('Host', 'Ask: "Is this your first time with us?"', 1),
    ('Host', 'Read the guest and seat accordingly', 2),
    ('Host', 'Notify the MOD immediately of any first-time guest', 3),
    ('Host', 'Introduce the server by name', 4),
    ('Host', 'Offer loyalty sign-up on every to-go order', 5),
    ('Server', 'Build rapport — use names, notice celebrations', 0),
    ('Server', 'One specific recommendation per course, every course', 1),
    ('Server', 'Mention loyalty early — name, points, offers', 2),
    ('Server', 'Ask: "Is this your first time dining with us?"', 3),
    ('Server', 'Fast first drinks, constant table scanning', 4),
    ('Server', 'Thank by name and invite back with something specific', 5),
    ('Bartender', 'Greet by name whenever possible', 0),
    ('Bartender', 'Ask a follow-up question from their last visit', 1),
    ('Bartender', 'First drink out fast — every time', 2),
    ('Bartender', 'Encourage second and third rounds naturally', 3),
    ('Bartender', 'Keep the bar top clean at all times', 4),
    ('Chef', 'Walk the dining room once per hour', 0),
    ('Chef', 'Inspect food quality with your eyes, not from the pass', 1),
    ('Chef', 'Introduce yourself at a table at least once per shift', 2),
    ('Chef', 'Take ownership of any issue — fix it immediately', 3),
    ('Manager', 'On the floor during every peak period', 0),
    ('Manager', 'Engage every table possible, approach first-time guests', 1),
    ('Manager', 'Thank every departing guest personally', 2),
    ('Manager', 'Coach in real time — correction and praise', 3),
    ('Manager', 'Log and follow through on every bounce-back interaction', 4)
  ) as d(department, item, sort_order);

  insert into department_meta (org_id, department, track_label, has_menu) values
    (new_org_id, 'Host', 'Seating & flow', false),
    (new_org_id, 'Server', 'Menu & product knowledge', true),
    (new_org_id, 'Bartender', 'Bar & beverage knowledge', true),
    (new_org_id, 'Chef', 'Kitchen standards & safety', true),
    (new_org_id, 'Manager', 'Operations & leadership', false);

  insert into department_training_items (org_id, department, item, sort_order)
  select new_org_id, d.department, d.item, d.sort_order
  from (values
    ('Host'::app_department, 'Know the floor plan and rotation order cold', 0),
    ('Host', 'Know how the reservation / waitlist system works', 1),
    ('Host', 'Know today''s realistic wait time before a guest asks', 2),
    ('Host', 'Know how to page a manager fast without leaving the door unattended', 3),
    ('Server', 'Know every dish''s key ingredients and prep style', 0),
    ('Server', 'Know common allergens for every menu item', 1),
    ('Server', 'Know today''s specials before the first table sits', 2),
    ('Server', 'Can describe any dish in one confident sentence, no notes', 3),
    ('Server', 'Know how to enter modifiers and allergies correctly in the POS', 4),
    ('Server', 'Suggest a specific pairing — a wine, side, or sauce — with every entrée recommendation', 5),
    ('Server', 'Have one ready-to-go upsell pairing for each of the top-selling dishes', 6),
    ('Server', 'Offer a dessert or appetizer pairing before the check is dropped', 7),
    ('Bartender', 'Know every cocktail recipe and pour standard exactly', 0),
    ('Bartender', 'Know the beer and wine list by style, not just name', 1),
    ('Bartender', 'Check ID every time policy requires it, no exceptions', 2),
    ('Bartender', 'Know how to 86 an item and communicate it to the floor fast', 3),
    ('Chef', 'Know safe holding temperatures cold and hot — never guess, ever', 0),
    ('Chef', 'Treat food safety as non-negotiable, not a busy-night shortcut', 1),
    ('Chef', 'Know allergen protocol and cross-contact prevention by station', 2),
    ('Chef', 'Know the plating standard for every dish on the line', 3),
    ('Chef', 'Know par levels and the prep list without being told', 4),
    ('Manager', 'Know daily KPI targets: sales, labor %, discount %', 0),
    ('Manager', 'Can run a pre-shift meeting in under 5 minutes', 1),
    ('Manager', 'Know scheduling and labor cost basics for the shift', 2),
    ('Manager', 'Know exactly when a discount needs owner-level approval', 3),
    ('Manager', 'Know what''s happening in the few blocks around the restaurant — events, competitors, foot traffic', 4)
  ) as d(department, item, sort_order);

  insert into hiring_traits (org_id, department, title, question, green_flag, red_flag, sort_order) values
    (new_org_id, 'Host', 'Composure under a full waitlist', 'Tell me about a time you had an angry line of people waiting and no tables ready. What did you do?', 'Stayed calm, communicated proactively, prioritized fairly.', 'Got flustered, avoided guests, or blamed the kitchen/servers.', 0),
    (new_org_id, 'Host', 'Spatial and organizational awareness', 'How would you decide where to seat a big walk-in group during a rush?', 'Thinks about flow, server sections, and guest comfort at once.', 'Would seat randomly with no awareness of server load.', 1),
    (new_org_id, 'Server', 'Sales confidence', 'Sell me a menu item you''ve never sold before, right now.', 'Confident, specific, enthusiastic without being pushy.', 'Hesitant, generic, or refuses to try.', 0),
    (new_org_id, 'Server', 'Resilience with a difficult table', 'Tell me about the worst table you''ve ever had. What happened?', 'Takes ownership, stays composed, focuses on resolution.', 'Blames the guest, gets defensive, no resolution offered.', 1),
    (new_org_id, 'Bartender', 'Multitasking under volume', 'Describe handling a slammed bar with tickets piling up.', 'Prioritizes, stays calm, communicates with the team.', 'Freezes, lets quality slip, or snaps at coworkers.', 0),
    (new_org_id, 'Bartender', 'Memory and rapport', 'How do you remember regulars'' usual orders?', 'Has a real system or habit and clearly cares about it.', 'Doesn''t try, or says it doesn''t really matter.', 1),
    (new_org_id, 'Chef', 'Consistency obsession', 'Tell me about a time you sent back your own team''s dish.', 'Holds a high bar even under pressure, cites a real standard.', 'Lets things slide to save time, no standard mentioned.', 0),
    (new_org_id, 'Chef', 'Coachability under pressure', 'Tell me about the last time a chef corrected you mid-service.', 'Took it well, adjusted immediately, no ego about it.', 'Got defensive, argued, or repeated the same mistake.', 1),
    (new_org_id, 'Manager', 'Leadership presence', 'Tell me about a time you had to correct a staff member mid-shift.', 'Direct but respectful, focused on the standard, not the person.', 'Avoided it, did it harshly in public, or let it slide.', 0),
    (new_org_id, 'Manager', 'Decision-making under conflict', 'A guest and a server disagree about what was ordered. What do you do?', 'Investigates fairly, protects the guest experience without throwing staff under the bus.', 'Automatically sides with one party, no real investigation.', 1);

  return new_org_id;
end;
$$;
