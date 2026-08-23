import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "Restaurant review management — Google reviews + surveys, read by AI";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "Restaurant review management",
    title: "Know exactly how your guests feel.",
    subtitle: "Google reviews and surveys in one place, read by AI — strengths, fixes, and next moves per location.",
    footer: "joinwingman.app/restaurant-review-management",
  });
}
