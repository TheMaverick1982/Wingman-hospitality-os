import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "Restaurant staff training software — role-based training, tests, and daily checklists";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "Restaurant training software",
    title: "Train every role to your standard.",
    subtitle: "Role-based training, learn-then-quiz tests, and daily checklists — in English or Spanish.",
    footer: "joinwingman.app/restaurant-training-software",
  });
}
