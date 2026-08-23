import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "The State of Restaurant Guest Retention — the report";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "The report",
    title: "The State of Restaurant Guest Retention",
    subtitle: "The numbers behind repeat business — why a 5% lift in returning guests is worth more than any new-customer push.",
    footer: "joinwingman.app/state-of-restaurant-retention",
  });
}
