import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "The restaurant guest journey — every moment, designed to earn a return visit";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "The guest journey",
    title: "Every moment of the guest experience, designed.",
    subtitle: "Map the whole visit into ordered moments — each with a standard, a script, and what a manager inspects.",
    footer: "joinwingman.app/guest-journey",
  });
}
