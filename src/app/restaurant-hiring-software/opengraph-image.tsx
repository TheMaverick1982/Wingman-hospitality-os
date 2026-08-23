import { marketingOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/social-cards/marketing-og";

export const alt = "Restaurant hiring software — applications, AI screening, and Google Jobs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return marketingOg({
    eyebrow: "Restaurant hiring software",
    title: "Hire restaurant staff who actually fit.",
    subtitle: "Applications, AI screening, trackable postings, and a careers page on Google Jobs — one pipeline.",
    footer: "joinwingman.app/restaurant-hiring-software",
  });
}
