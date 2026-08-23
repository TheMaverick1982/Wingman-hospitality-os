import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "Restaurant guest retention software — turn first-time guests into regulars";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "Guest retention software",
    title: "Turn first-time guests into regulars.",
    subtitle: "Track every first-timer visit by visit and give your team the habits to bring them back.",
    footer: "joinwingman.app/guest-retention-software",
  });
}
