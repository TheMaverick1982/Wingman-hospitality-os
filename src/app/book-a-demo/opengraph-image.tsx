import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "Book a Wingman demo — see it in five minutes";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "Book a demo",
    title: "See Wingman in five minutes.",
    subtitle: "A quick, no-pressure walkthrough of how it turns first-time guests into regulars.",
    footer: "joinwingman.app/book-a-demo",
  });
}
