import type { Metadata } from "next";
import { FeatureLandingPage, type FeatureLandingConfig } from "@/components/marketing/feature-landing";
import { ReviewsVisual } from "@/components/marketing/feature-visuals";

export const metadata: Metadata = {
  title: "Restaurant Review Management Software",
  description:
    "Wingman brings your Google reviews and first-party guest surveys into one place and reads them with AI — your rating and trend, what guests love, where to improve, and concrete next moves, per location.",
  keywords: [
    "restaurant review management software",
    "restaurant google reviews",
    "restaurant reputation management",
    "restaurant customer feedback software",
    "restaurant guest survey",
    "analyze restaurant reviews",
  ],
  alternates: { canonical: "/restaurant-review-management" },
  openGraph: {
    title: "Restaurant Review Management Software | Wingman",
    description: "Your Google reviews and guest surveys in one place, read by AI — strengths, fixes, and next moves per location.",
    url: "/restaurant-review-management",
    type: "website",
  },
};

const config: FeatureLandingConfig = {
  slug: "restaurant-review-management",
  eyebrow: "Restaurant review management",
  h1: "Know exactly how your guests feel.",
  subhead:
    "Connect your Google Business Profile and collect first-party surveys, and Wingman reads all of it for you — your rating and trend, what guests consistently love, where you're slipping, and the concrete moves to raise your score, per location.",
  heroVisual: <ReviewsVisual />,
  problem: {
    heading: "Feedback is scattered, and nobody has time to read it all.",
    body: "Google reviews live in one place, comment cards in another, and the patterns hide in the noise until a one-star review shows up days later. Wingman pulls your reviews and surveys together and turns hundreds of comments into a clear read: your strengths, your recurring problems, and what to fix this week — grounded in hospitality-first thinking, not generic sentiment scores.",
  },
  steps: [
    { title: "Connect your Google reviews", body: "Link your Google Business Profile (official, read-only — Wingman never posts) and it pulls each location's reviews automatically, refreshing every week." },
    { title: "AI reads them for you", body: "Per location: your rating and trend, what guests consistently praise, where you're slipping (the real, recurring complaints), the themes, and a short list of concrete actions to raise your rating." },
    { title: "First-party surveys too", body: "A per-location survey QR and short link (table tent, receipt, window) captures how guests felt in the moment — food, service, likelihood to return — and can credit the server by name for a shout-out." },
    { title: "Both, side by side", body: "Your public Google reputation and your private in-the-moment feedback live on the same page, analyzed together — so you see the full picture, not half of it." },
    { title: "Per location, no blind spots", body: "Multi-location groups get a separate read for each store, so you can tell which rooms are winning guests over and which need attention — before it shows up in the ratings." },
    { title: "Recognition, not just problems", body: "A 'how guests are feeling' card sits on everyone's dashboard with the average rating and shout-outs that name the server — so wins get seen, not just issues." },
  ],
  stats: [
    { value: "Google + surveys", label: "Your public reviews and first-party feedback, together in one place." },
    { value: "AI read", label: "Hundreds of comments turned into strengths, fixes, and next moves." },
    { value: "Per location", label: "A separate read for every store — no room hides in the average." },
  ],
  midCta: { headline: "Turn your reviews into a to-do list.", sub: "See what your guests are really telling you — and what to do about it." },
  otherSystems: [
    { title: "Guest retention tracking", body: "The reason reviews matter — turn first-time guests into loyal regulars.", href: "/guest-retention-software" },
    { title: "Staff training & standards", body: "Fix what the reviews surface — training and daily habits that raise the score.", href: "/restaurant-training-software" },
    { title: "Restaurant hiring", body: "Great reviews start with great hires — applications, AI screening, careers page.", href: "/restaurant-hiring-software" },
  ],
  faqs: [
    { q: "How do you connect my Google reviews?", a: "An owner connects your Google Business Profile through Google's official OAuth (read-only access, scope limited to reading your listings). Wingman never posts, edits, or replies to anything. You then link each of your locations to its Google listing." },
    { q: "What does the AI actually give me?", a: "For each location: an overall rating and trend, a list of what guests consistently love, the recurring complaints to fix, the themes people mention, and a few concrete, hospitality-first actions to raise your rating — all refreshed as new reviews come in." },
    { q: "Is this just Google reviews, or my own surveys too?", a: "Both. Wingman also gives you a per-location guest survey (QR + short link) for in-the-moment first-party feedback, and shows it alongside your Google reviews so you get the full picture." },
    { q: "Does it work for multiple locations?", a: "Yes — each location connects to its own Google listing and gets its own analysis, so multi-unit operators can compare stores and coach where feedback is slipping." },
    { q: "Will it reply to reviews for me?", a: "Not today — v1 is read-and-analyze only, deliberately, so you stay in control of your voice. Replying is on the roadmap." },
  ],
  finalCta: { headline: "Stop guessing how your guests feel.", sub: "Connect your reviews and surveys, and let Wingman tell you what to fix — and what to celebrate." },
};

export default function Page() {
  return <FeatureLandingPage config={config} />;
}
