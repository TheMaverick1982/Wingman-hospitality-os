import type { Metadata } from "next";
import { FeatureLandingPage, type FeatureLandingConfig } from "@/components/marketing/feature-landing";
import { RetentionVisual } from "@/components/marketing/feature-visuals";

export const metadata: Metadata = {
  title: "Restaurant Guest Retention Software",
  description:
    "Wingman's guest retention system tracks first-time restaurant guests visit by visit and turns them into regulars — log first-timers on the floor, run deliberate win-backs, and see repeat-rate by location.",
  keywords: [
    "restaurant guest retention software",
    "restaurant customer retention",
    "turn first-time guests into regulars",
    "restaurant repeat customers",
    "guest loyalty for restaurants",
    "restaurant win-back",
  ],
  alternates: { canonical: "/guest-retention-software" },
  openGraph: {
    title: "Restaurant Guest Retention Software | Wingman",
    description: "Track first-time guests visit by visit and turn them into loyal regulars — the retention layer for hospitality.",
    url: "/guest-retention-software",
    type: "website",
  },
};

const config: FeatureLandingConfig = {
  slug: "guest-retention-software",
  eyebrow: "Guest retention software",
  h1: "Turn first-time guests into regulars.",
  subhead:
    "Most restaurants pour money into getting new guests through the door, then never see them again. Wingman tracks every first-timer, visit by visit, and gives your team the habits to bring them back — because a 5% lift in returning guests is worth more than any new-customer push.",
  heroVisual: <RetentionVisual />,
  problem: {
    heading: "You're winning first visits and losing the relationship.",
    body: "A guest's first visit is the most expensive one you'll ever pay for — and without a system, whether they come back is left to luck. There's no record of who was new, no nudge to win them back, and no way to know if your repeat rate is climbing or quietly bleeding out. Wingman makes retention something you run on purpose, not hope for.",
  },
  steps: [
    { title: "Log first-timers on the floor", body: "Your team logs a first-time guest right from their phone at the table or door — it's deliberate and personal, capturing the guest and the experience while it's fresh, not scraped from a POS export." },
    { title: "Guest Bounce Back", body: "Wingman surfaces who came back — and who almost didn't — so a win-back is a considered, personal touch, not a mass blast. The people you already paid to acquire get a real reason to return." },
    { title: "Track the journey visit by visit", body: "Visit 1 (first impression) → Visit 2 (the bounce-back) → Visit 3 (becoming a regular) → loyal regular. Preferences and notes travel with the guest across every location, so the relationship compounds." },
    { title: "See repeat rate by location", body: "Company-wide and per-location repeat-rate and trends, so you can tell which rooms turn guests into regulars and which are leaking — and coach to it before it shows up in the P&L." },
    { title: "Catch service recovery early", body: "Every comp and service recovery gets a reason attached, so recurring problems surface instead of hiding in a spreadsheet — and coaching happens in the moment, not at a quarterly review." },
    { title: "It's kept clean and separate", body: "Retention tracking is deliberately separate from your survey feedback and reviews, so a survey response never inflates a visit — your repeat-rate numbers stay honest." },
  ],
  stats: [
    { value: "5%", label: "A 5% lift in guest retention can lift profit dramatically — the math the whole product is built around." },
    { value: "Visit by visit", label: "Every first-timer tracked from first impression to loyal regular." },
    { value: "Per location", label: "Repeat-rate and trends for each room, so you coach where it's slipping." },
  ],
  midCta: { headline: "Stop paying for guests you never see again.", sub: "See how Wingman turns first visits into regulars on your own floor." },
  otherSystems: [
    { title: "Staff training & standards", body: "The service that earns a second visit — role-based training, tests, and daily habits.", href: "/restaurant-training-software" },
    { title: "Guest reviews & feedback", body: "First-party surveys plus AI analysis of your Google reviews, side by side.", href: "/restaurant-review-management" },
    { title: "Restaurant hiring", body: "Hire people who fit your culture — applications, AI screening, and a careers page.", href: "/restaurant-hiring-software" },
  ],
  faqs: [
    { q: "How does Wingman know who's a first-time guest?", a: "Your team logs first-timers on the floor from their phone — a quick, deliberate entry at the table or door. It's intentionally hands-on and personal rather than auto-scraped, because that context (who they are, what the visit was like) is exactly what makes the win-back land." },
    { q: "Isn't this just a loyalty punch-card app?", a: "No. Punch cards reward people already coming back. Wingman is about the guests who came once and vanished — surfacing them, giving your team a personal reason to reach out, and tracking whether first visits actually become regulars, by location." },
    { q: "Does a survey or review count as a visit?", a: "No — retention tracking is deliberately separate from Guest Reviews and feedback, so responses never inflate visit counts. Your repeat-rate data stays clean." },
    { q: "Can I see retention across multiple locations?", a: "Yes. You get a company-wide view plus each location's own repeat-rate and trend, so you can see which rooms turn guests into regulars and which need attention." },
    { q: "How does retention connect to the rest of Wingman?", a: "Retention is the outcome; training, standards, and hiring are how you get there. Wingman runs the whole loop in one place, so the service on the floor and the guest coming back are part of the same system." },
  ],
  finalCta: { headline: "Make retention something you run, not hope for.", sub: "See the guest journey — first visit to loyal regular — on your own floor." },
};

export default function Page() {
  return <FeatureLandingPage config={config} />;
}
