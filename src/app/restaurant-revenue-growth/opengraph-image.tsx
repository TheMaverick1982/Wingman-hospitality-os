import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "Restaurant revenue growth planner — small gains across channels compound";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "Revenue growth planner",
    title: "Small gains, compounded, are a huge number.",
    subtitle: "Nudge three channels a few percent each and watch restaurant revenue multiply.",
    footer: "joinwingman.app/restaurant-revenue-growth",
  });
}
