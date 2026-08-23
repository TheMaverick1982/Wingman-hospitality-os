import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "Wingman pricing — simple per-location plans for restaurants";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "Pricing",
    title: "Simple, per-location pricing.",
    subtitle: "The whole retention system — training, standards, hiring, guest follow-up — for less than one lost regular a month.",
    footer: "joinwingman.app/pricing",
  });
}
