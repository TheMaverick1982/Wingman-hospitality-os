export const ALL_DEPARTMENTS = ["Host", "Server", "Bartender", "Chef", "Manager"] as const;
export type Department = (typeof ALL_DEPARTMENTS)[number];

export const DISCOUNT_CATEGORIES = [
  "Food Quality Issue",
  "Temperature Issue",
  "Ticket Accuracy Issue",
  "Service Delay",
  "Hospitality Recovery Gesture",
  "System/Operational Error",
  "Never Greeted",
  "Order Errors",
  "Walkout",
  "Rude Interaction",
  "Wrong Check",
  "Other",
] as const;

export const CULTURE_TAGS = ["Ownership", "Guest Connection", "Teamwork", "Went Above"] as const;

export const SPOT_CHECK_DIMENSIONS = [
  "Energy / Presence",
  "Personalization",
  "Guidance (Sales Behavior)",
  "Awareness",
  "Closing (Return Setup)",
] as const;

export const DAILY_CHECKLIST_ITEMS = [
  "Walked the floor during every peak period",
  "Personally approached at least 3 returning guests",
  "Thanked every departing guest personally",
  "Logged today's first-time guest bounce-back interactions",
  "Confirmed bathrooms, entry, and dining room hit standard",
  "Coached at least one real-time moment (correction or praise)",
] as const;

export const RECOMMENDATION_OPTIONS = ["Strong fit", "Fit", "Unsure", "Not a fit"] as const;

export const PRE_SHIFT_ITEMS = [
  "Uniform and appearance are shift-ready",
  "Know tonight's specials and any 86'd items",
  "Know today's reservations and any large parties",
  "Reviewed yesterday's guest feedback or flags",
  "Ready to set the tone — positive energy at the door",
] as const;

export const AMBIANCE_DIMENSIONS = [
  "Cleanliness (floors, tables, restrooms)",
  "Music volume & selection",
  "Lighting",
  "Host stand / entrance first impression",
  "Temperature comfort",
] as const;
