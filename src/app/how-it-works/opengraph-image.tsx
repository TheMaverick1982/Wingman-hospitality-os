import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "How Wingman works — turn first-time restaurant guests into regulars";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "How it works",
    title: "Turn first-time guests into regulars.",
    subtitle: "The culture, training, and accountability system hospitality teams actually use, every shift.",
    footer: "joinwingman.app/how-it-works",
  });
}
