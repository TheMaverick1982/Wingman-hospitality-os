import type { Department } from "@/lib/constants";

// Starter content for every built-in role. When a role is activated (in the
// Setup Wizard or added on the Training/Hiring page), and it has no content yet,
// we seed it from here so it's never a blank page — hospitality standards, role
// duties, and interview traits, in the same style as the original five.
//
// The original five (Host, Server, Bartender, Chef, Manager) mirror the seed in
// migration 0001 so re-adding a removed role restores the same starting point.
// Seeded rows use source "default" (not "wingman"), so they read as sample
// content and never falsely mark onboarding as "built by AI".

export type HiringSeed = { title: string; question: string; green_flag: string; red_flag: string };
export type RoleSeed = {
  trackLabel: string;
  hasMenu: boolean;
  standards: string[]; // hospitality behaviors → department_standards
  duties: string[]; // role-specific skills → department_training_items
  hiring: HiringSeed[]; // interview traits → hiring_traits
};

export const ROLE_SEED: Record<Department, RoleSeed> = {
  Host: {
    trackLabel: "Seating & flow",
    hasMenu: false,
    standards: [
      "Greet every guest immediately — smile, eye contact, drop what you're doing",
      'Ask: "Is this your first time with us?"',
      "Read the guest and seat accordingly",
      "Notify the MOD immediately of any first-time guest",
      "Introduce the server by name",
      "Offer loyalty sign-up on every to-go order",
    ],
    duties: [
      "Know the floor plan and rotation order cold",
      "Know how the reservation / waitlist system works",
      "Know today's realistic wait time before a guest asks",
      "Know how to page a manager fast without leaving the door unattended",
    ],
    hiring: [
      { title: "Composure under a full waitlist", question: "Tell me about a time you had an angry line of people waiting and no tables ready. What did you do?", green_flag: "Stayed calm, communicated proactively, prioritized fairly.", red_flag: "Got flustered, avoided guests, or blamed the kitchen/servers." },
      { title: "Spatial and organizational awareness", question: "How would you decide where to seat a big walk-in group during a rush?", green_flag: "Thinks about flow, server sections, and guest comfort at once.", red_flag: "Would seat randomly with no awareness of server load." },
    ],
  },
  Server: {
    trackLabel: "Menu & product knowledge",
    hasMenu: true,
    standards: [
      "Build rapport — use names, notice celebrations",
      "One specific recommendation per course, every course",
      "Mention loyalty early — name, points, offers",
      'Ask: "Is this your first time dining with us?"',
      "Fast first drinks, constant table scanning",
      "Thank by name and invite back with something specific",
    ],
    duties: [
      "Know every dish's key ingredients and prep style",
      "Know common allergens for every menu item",
      "Know today's specials before the first table sits",
      "Can describe any dish in one confident sentence, no notes",
      "Know how to enter modifiers and allergies correctly in the POS",
    ],
    hiring: [
      { title: "Sales confidence", question: "Sell me a menu item you've never sold before, right now.", green_flag: "Confident, specific, enthusiastic without being pushy.", red_flag: "Hesitant, generic, or refuses to try." },
      { title: "Resilience with a difficult table", question: "Tell me about the worst table you've ever had. What happened?", green_flag: "Takes ownership, stays composed, focuses on resolution.", red_flag: "Blames the guest, gets defensive, no resolution offered." },
    ],
  },
  Busser: {
    trackLabel: "Table turns & flow",
    hasMenu: false,
    standards: [
      "Clear plates quietly, without interrupting the conversation",
      "Refill water before a guest has to ask",
      "Greet guests warmly whenever you approach the table",
      "Reset tables fast and correctly so hosts can seat",
      "Notice a guest who needs something and flag the server",
      "Thank guests as they leave when you're near the door",
    ],
    duties: [
      "Know the table numbers and section map cold",
      "Know the proper reset — settings, spacing, and stock",
      "Know how to clear from the right without reaching across a guest",
      "Know where every bussing station and its stock lives",
      "Know how to signal a turned table to the host fast",
    ],
    hiring: [
      { title: "Hustle & awareness", question: "Tell me about a busy shift where you had to keep tables moving. How did you stay ahead of it?", green_flag: "Anticipates, moves with urgency, reads the room.", red_flag: "Waits to be told, misses obvious needs." },
      { title: "Team-first attitude", question: "A server is buried and it's not 'your' table. What do you do?", green_flag: "Jumps in to help without being asked.", red_flag: "Sticks rigidly to their own section." },
    ],
  },
  "Food Runner": {
    trackLabel: "Delivery & the table",
    hasMenu: true,
    standards: [
      "Deliver every plate to the right seat — no auctioning",
      "Announce the dish by name as you set it down",
      "Read the table — anything else they need right now?",
      "Handle allergy plates with visible care and a verbal confirm",
      "Move with urgency so food arrives hot",
      "Leave the guest with a warm 'enjoy' and eye contact",
    ],
    duties: [
      "Know every dish's name, components, and seat position",
      "Know the table and seat numbering system cold",
      "Know allergen protocol and how to verify an allergy plate",
      "Know how to read a ticket and match it to the plate",
      "Know how to carry and set multiple plates correctly",
    ],
    hiring: [
      { title: "Attention to detail", question: "How do you make sure the right plate gets to the right guest at a big table?", green_flag: "Uses seat numbers / a system, double-checks.", red_flag: "Guesses or 'auctions' plates to the table." },
      { title: "Sense of urgency", question: "Tell me about keeping food moving when the kitchen is slammed.", green_flag: "Moves fast, protects food temperature and quality.", red_flag: "Ambles, lets plates sit and go cold." },
    ],
  },
  Bartender: {
    trackLabel: "Bar & beverage knowledge",
    hasMenu: true,
    standards: [
      "Greet by name whenever possible",
      "Ask a follow-up question from their last visit",
      "First drink out fast — every time",
      "Encourage second and third rounds naturally",
      "Keep the bar top clean at all times",
    ],
    duties: [
      "Know every cocktail recipe and pour standard exactly",
      "Know the beer and wine list by style, not just name",
      "Check ID every time policy requires it, no exceptions",
      "Know how to 86 an item and communicate it to the floor fast",
    ],
    hiring: [
      { title: "Multitasking under volume", question: "Describe handling a slammed bar with tickets piling up.", green_flag: "Prioritizes, stays calm, communicates with the team.", red_flag: "Freezes, lets quality slip, or snaps at coworkers." },
      { title: "Memory and rapport", question: "How do you remember regulars' usual orders?", green_flag: "Has a real system or habit and clearly cares about it.", red_flag: "Doesn't try, or says it doesn't really matter." },
    ],
  },
  Barista: {
    trackLabel: "Coffee & beverage craft",
    hasMenu: true,
    standards: [
      "Greet every guest at the counter with a smile and eye contact",
      "Learn and use regulars' names and usual orders",
      "Make a genuine recommendation when a guest is unsure",
      "Hand off every drink with the guest's name and a thank-you",
      "Keep the counter and pickup area spotless",
      "Invite them back — mention a special or loyalty perk",
    ],
    duties: [
      "Dial in the espresso — grind, dose, and yield to spec",
      "Steam milk to the correct texture and temperature",
      "Know every drink recipe and build order exactly",
      "Keep the machine and grinder clean and calibrated",
      "Know the pastry / food menu and pairings to suggest",
    ],
    hiring: [
      { title: "Craft under a rush", question: "Describe keeping drink quality up when the line is out the door.", green_flag: "Holds standards, stays calm and fast.", red_flag: "Lets quality slide under pressure." },
      { title: "Warmth with regulars", question: "How do you turn a first-time coffee guest into a regular?", green_flag: "Names, recommendations, a genuine connection.", red_flag: "Transactional, makes no effort to connect." },
    ],
  },
  Chef: {
    trackLabel: "Kitchen standards & safety",
    hasMenu: false,
    standards: [
      "Walk the dining room once per hour",
      "Inspect food quality with your eyes, not from the pass",
      "Introduce yourself at a table at least once per shift",
      "Take ownership of any issue — fix it immediately",
    ],
    duties: [
      "Know safe holding temperatures cold and hot — never guess, ever",
      "Treat food safety as non-negotiable, not a busy-night shortcut",
      "Know allergen protocol and cross-contact prevention by station",
      "Know the plating standard for every dish on the line",
      "Know par levels and the prep list without being told",
    ],
    hiring: [
      { title: "Consistency obsession", question: "Tell me about a time you sent back your own team's dish.", green_flag: "Holds a high bar even under pressure, cites a real standard.", red_flag: "Lets things slide to save time, no standard mentioned." },
      { title: "Coachability under pressure", question: "Tell me about the last time a chef corrected you mid-service.", green_flag: "Took it well, adjusted immediately, no ego about it.", red_flag: "Got defensive, argued, or repeated the same mistake." },
    ],
  },
  "Line Cook": {
    trackLabel: "Station & execution",
    hasMenu: false,
    standards: [
      "Treat every plate as if it's going to your own table",
      "Own a mistake and re-fire immediately, no excuses",
      "Communicate 86s and delays to the floor fast",
      "Keep plating consistent to the standard, every ticket",
      "Support other stations when you're in the weeds together",
      "Keep your station clean as you go, not just at close",
    ],
    duties: [
      "Know your station's mise en place and par levels cold",
      "Know safe holding temps hot and cold — never guess",
      "Know every recipe and plating spec for your station",
      "Know allergen protocol and cross-contact prevention",
      "Know how to read the rail and call / receive times",
    ],
    hiring: [
      { title: "Consistency under fire", question: "Tell me about a slammed service and how you kept quality up.", green_flag: "Holds the standard, stays organized under pressure.", red_flag: "Quality drops, blames the rush." },
      { title: "Coachability", question: "Tell me about the last time a chef corrected you mid-service.", green_flag: "Took it well, adjusted immediately.", red_flag: "Defensive, argued, or repeated the mistake." },
    ],
  },
  Dishwasher: {
    trackLabel: "Sanitation & flow",
    hasMenu: false,
    standards: [
      "Keep clean plates and glassware flowing so service never stalls",
      "Handle glassware and china carefully to reduce breakage",
      "Keep the dish area clean, safe, and organized",
      "Flag low stock of clean items before it becomes a problem",
      "Pitch in on prep or bussing when the pit is caught up",
    ],
    duties: [
      "Know the dish machine cycle, chemicals, and safe temps",
      "Know where every clean item is stored and restocked",
      "Know sanitation standards and how to sanitize by station",
      "Know how to break down and clean the machine at close",
      "Know how to handle sharp and fragile items safely",
    ],
    hiring: [
      { title: "Reliability & stamina", question: "This job is physical and relentless on a busy night. How do you keep pace?", green_flag: "Steady, dependable, takes pride in keeping up.", red_flag: "Looks for shortcuts, fades under volume." },
      { title: "Team support", question: "The line is buried and your pit is caught up. What do you do?", green_flag: "Jumps in to help without being asked.", red_flag: "Stays put — 'not my job.'" },
    ],
  },
  Expo: {
    trackLabel: "The pass & timing",
    hasMenu: true,
    standards: [
      "Own the pass — nothing leaves that isn't right",
      "Verify every plate against the ticket before it runs",
      "Call clear timing so a table's food arrives together",
      "Catch allergy and modifier errors before they reach a guest",
      "Keep runners and servers in sync on what's firing",
      "Wipe rims and plate edges — presentation is the last check",
    ],
    duties: [
      "Know every dish's components, garnish, and plating spec",
      "Know the table / seat numbering and how tickets map to it",
      "Know allergen protocol and how to verify a flagged plate",
      "Know how to read the rail and coordinate fire / call times",
      "Know how to communicate delays and 86s to the floor fast",
    ],
    hiring: [
      { title: "Command of the pass", question: "How do you keep a table's food going out together when the kitchen is slammed?", green_flag: "Coordinates timing, communicates clearly, stays calm.", red_flag: "Loses control of timing; plates go out cold or split." },
      { title: "Quality gatekeeping", question: "A plate looks slightly off but you're buried. What do you do?", green_flag: "Holds the standard, fixes it before it runs.", red_flag: "Lets it slide to keep up." },
    ],
  },
  Sommelier: {
    trackLabel: "Wine & beverage program",
    hasMenu: true,
    standards: [
      "Read the table before recommending — occasion, taste, budget",
      "Guide, don't lecture — make wine approachable and fun",
      "Offer a pairing for the table's dishes, at more than one price",
      "Present and open bottles with care and a short story",
      "Check back and adjust — meet the guest where they are",
      "Create a reason to return — a bottle to try next time",
    ],
    duties: [
      "Know the wine list by region, style, and pairing cold",
      "Know current by-the-glass pours, vintages, and 86s",
      "Know proper service — temperature, glassware, decanting",
      "Know inventory and how to upsell without pushing",
      "Know how to train servers on the week's key pours",
    ],
    hiring: [
      { title: "Approachable expertise", question: "A guest is intimidated by the wine list. How do you help them choose?", green_flag: "Makes it easy and fun, no snobbery, reads their budget.", red_flag: "Lectures, shows off, or makes them feel small." },
      { title: "Selling through service", question: "How do you guide a table to a better bottle without pressure?", green_flag: "Frames it around their taste and the meal, not price.", red_flag: "Pushes the expensive bottle, or doesn't try at all." },
    ],
  },
  Manager: {
    trackLabel: "Operations & leadership",
    hasMenu: false,
    standards: [
      "On the floor during every peak period",
      "Engage every table possible, approach first-time guests",
      "Thank every departing guest personally",
      "Coach in real time — correction and praise",
      "Log and follow through on every bounce-back interaction",
    ],
    duties: [
      "Know daily KPI targets: sales, labor %, discount %",
      "Can run a pre-shift meeting in under 5 minutes",
      "Know scheduling and labor cost basics for the shift",
      "Know exactly when a discount needs owner-level approval",
      "Know what's happening in the few blocks around the restaurant — events, competitors, foot traffic",
    ],
    hiring: [
      { title: "Leadership presence", question: "Tell me about a time you had to correct a staff member mid-shift.", green_flag: "Direct but respectful, focused on the standard, not the person.", red_flag: "Avoided it, did it harshly in public, or let it slide." },
      { title: "Decision-making under conflict", question: "A guest and a server disagree about what was ordered. What do you do?", green_flag: "Investigates fairly, protects the guest experience without throwing staff under the bus.", red_flag: "Automatically sides with one party, no real investigation." },
    ],
  },
};
