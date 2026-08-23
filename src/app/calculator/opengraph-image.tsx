import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "Restaurant retention revenue calculator — see what repeat guests are worth";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "Free calculator",
    title: "What is a 5% lift in repeat guests worth to you?",
    subtitle: "Plug in your covers and check average — see the revenue hiding in retention.",
    footer: "joinwingman.app/calculator",
  });
}
