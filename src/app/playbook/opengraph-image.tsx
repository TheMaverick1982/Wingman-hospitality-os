import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "The Wingman Playbook — hospitality retention, training, and hiring";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "The Playbook",
    title: "Practical hospitality, one play at a time.",
    subtitle: "Retention, training, standards, and hiring — the tactics that turn guests into regulars.",
    footer: "joinwingman.app/playbook",
  });
}
