import type { Metadata } from "next";
import { FeatureLandingPage, type FeatureLandingConfig } from "@/components/marketing/feature-landing";
import { RevenuePlanner } from "@/components/marketing/revenue-planner";

export const metadata: Metadata = {
  title: "Restaurant Revenue Growth Planner",
  description:
    "See how small gains across four channels — repeat rate, average check, visit frequency, and new guests — compound into a big annual revenue lift. A live planner, plus the Wingman systems that move each lever.",
  keywords: [
    "how to increase restaurant revenue",
    "restaurant revenue growth",
    "restaurant sales growth",
    "grow restaurant revenue",
    "restaurant revenue calculator",
    "increase restaurant sales",
  ],
  alternates: { canonical: "/restaurant-revenue-growth" },
  openGraph: {
    title: "Restaurant Revenue Growth Planner | Wingman",
    description: "Nudge four channels a few percent each and watch revenue compound — then see the systems that make it happen.",
    url: "/restaurant-revenue-growth",
    type: "website",
  },
};

const config: FeatureLandingConfig = {
  slug: "restaurant-revenue-growth",
  eyebrow: "Revenue growth planner",
  h1: "Small gains, compounded, are a huge number.",
  subhead:
    "You don't need one big win to grow revenue — you need a few points across the channels you already have. Drag the sliders and watch how retention, check size, frequency, and new guests multiply together.",
  heroVisual: <RevenuePlanner />,
  problem: {
    heading: "Chasing one big lever is the slow way to grow.",
    body: "Most restaurants pour everything into new-customer marketing — the single most expensive lever there is. But revenue is the product of several levers, and improving each a little compounds fast. The catch: without a system, none of them move reliably. Wingman is how you actually push all of them, every shift.",
  },
  steps: [
    { title: "Repeat rate → guest retention", body: "Turning more first-timers into regulars is the highest-leverage channel you have — you already paid to get them in the door. Wingman tracks every first-timer and gives your team the habits to bring them back." },
    { title: "Average check → staff training", body: "A trained team that makes one genuine recommendation per course lifts the check without discounting. Wingman's role-based training and tests make great service the standard, not the exception." },
    { title: "Visit frequency → bounce-back", body: "Getting regulars back one more time a month multiplies against everything else. Wingman surfaces who's slipping and prompts a personal, well-timed win-back." },
    { title: "New guests → reviews & reputation", body: "A stronger Google rating quietly pulls in more first-time guests. Wingman reads your reviews, tells you what to fix, and helps you earn the rating that drives free traffic." },
    { title: "They compound, not just add", body: "Because these levers feed the same revenue, a 5% gain in four places isn't a 20% lift — it's more. That's the whole point: modest, achievable gains that multiply into a number that changes your year." },
    { title: "One system moves all four", body: "The reason most plans stall is that four separate tools (or none) can't move four levers together. Wingman runs culture, training, retention, and reviews in one place, so the whole plan actually happens." },
  ],
  stats: [
    { value: "4 channels", label: "Repeat rate, average check, visit frequency, and new guests — moved together." },
    { value: "Compounding", label: "Gains multiply instead of adding, so small nudges become a big number." },
    { value: "One platform", label: "The systems that move every lever, in one place your team uses each shift." },
  ],
  midCta: { headline: "See these numbers on your own restaurant.", sub: "We'll map each channel to the plan that gets you there." },
  otherSystems: [
    { title: "Guest retention tracking", body: "The biggest lever — turn first-time guests into loyal regulars.", href: "/guest-retention-software" },
    { title: "Staff training & standards", body: "The training that lifts your average check without discounting.", href: "/restaurant-training-software" },
    { title: "Review management", body: "The rating that quietly brings more new guests through the door.", href: "/restaurant-review-management" },
  ],
  faqs: [
    { q: "Is the planner's math realistic?", a: "Yes — it's a simplified but honest model. The four channels feed one annual-revenue projection, so their gains compound the way they do in a real business (improving repeat rate, frequency, and new guests all multiply your repeat revenue, and a higher check lifts everything). It's meant to show the shape of the opportunity, not to be an exact forecast." },
    { q: "Why do small percentages turn into such a big number?", a: "Because the levers multiply rather than add. If four channels each improve 5%, you don't get +20% — you get roughly 1.05⁴, and on a business doing seven figures that difference is enormous. Compounding is the entire strategy." },
    { q: "Which lever should I focus on first?", a: "Usually repeat rate — you've already paid to acquire those guests, so bringing more of them back is the cheapest growth you'll ever buy. But the power is in nudging all four together, which is exactly what Wingman is built to do." },
    { q: "How does Wingman actually move these numbers?", a: "Each channel maps to a Wingman system: retention tracking for repeat rate and frequency, role-based training for average check, and review management for new-guest traffic — all run from one place so the plan happens every shift, not just on paper." },
    { q: "Can I model my own numbers?", a: "Yes — set your monthly new guests and average check in the planner and drag the sliders to see your own upside. Then book a demo and we'll build the real plan to get there." },
  ],
  finalCta: { headline: "Turn a few points per channel into your best year.", sub: "See the planner run on your real numbers — and the system that makes it happen." },
};

export default function Page() {
  return <FeatureLandingPage config={config} />;
}
