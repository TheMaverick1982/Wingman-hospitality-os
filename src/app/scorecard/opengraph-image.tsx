import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "Restaurant retention scorecard — how strong is your guest-retention system?";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "Free scorecard",
    title: "How strong is your guest-retention system?",
    subtitle: "A 2-minute scorecard that grades your culture, training, and follow-up — and shows the gaps.",
    footer: "joinwingman.app/scorecard",
  });
}
