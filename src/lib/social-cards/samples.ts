import type { CardSpec } from "./schemes";

// Canned specs that mirror the existing posting system, so the preview gallery
// shows every card type across all three color schemes.
export const SAMPLE_CARDS: CardSpec[] = [
  { type: "brand", scheme: "blue", headline: "Your best marketing already ate here." },
  { type: "stat", scheme: "charcoal", stat: "1 in 4", subhead: "first-time guests ever come back.", support: "Most owners can't tell you their number." },
  { type: "calc", scheme: "blue", intro: "A 10-point lift in repeat rate can be worth", number: "$84k", outro: "a year. What's it worth for you?" },
  { type: "tip", scheme: "cream", title: "3 ways to earn visit #2", items: ["Greet every guest within 30 seconds.", "One genuine check-back — not three robotic ones.", "Give them a reason to return before they pay."] },
  { type: "brand", scheme: "cream", headline: "Great service can't live on a poster in the break room." },
  { type: "brand", scheme: "charcoal", headline: "Hospitality isn't a personality. It's a system." },
  { type: "stat", scheme: "blue", stat: "$1,000+", subhead: "what one regular is worth a year.", support: "Same guest. Zero new ad spend." },
  { type: "tip", scheme: "charcoal", title: "The Tuesday-shift problem", items: ["Same menu, same prices.", "Half the repeat rate of your Friday crew.", "Most operators can't even see it."] },
];
