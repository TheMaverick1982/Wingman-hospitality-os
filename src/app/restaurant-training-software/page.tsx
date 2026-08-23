import type { Metadata } from "next";
import { FeatureLandingPage, type FeatureLandingConfig } from "@/components/marketing/feature-landing";
import { TrainingVisual } from "@/components/marketing/feature-visuals";

export const metadata: Metadata = {
  title: "Restaurant Staff Training Software",
  description:
    "Wingman's restaurant training system: role-by-role training built from your standards, learn-then-quiz tests that prove staff learned it, daily checklists, and sign-offs — in English or Spanish, one profile per person.",
  keywords: [
    "restaurant staff training software",
    "restaurant employee training",
    "restaurant training program",
    "restaurant SOP software",
    "restaurant onboarding software",
    "restaurant checklist app",
  ],
  alternates: { canonical: "/restaurant-training-software" },
  openGraph: {
    title: "Restaurant Staff Training Software | Wingman",
    description: "Role-based training, learn-then-quiz tests, and daily checklists that hold your standard every shift — in English or Spanish.",
    url: "/restaurant-training-software",
    type: "website",
  },
};

const config: FeatureLandingConfig = {
  slug: "restaurant-training-software",
  eyebrow: "Restaurant training software",
  h1: "Train every role to your standard.",
  subhead:
    "Upload the handbook nobody reads — or start from nothing — and Wingman builds a complete, hospitality-first training program for every role, proves your team actually learned it, and keeps the standard alive with daily habits.",
  heroVisual: <TrainingVisual />,
  problem: {
    heading: "Your standard lives in your head, not on the floor.",
    body: "The training binder is out of date, onboarding is whoever's free that day, and you find out someone never learned the allergy protocol when a guest is already upset. Wingman turns how you want things done into training every role can follow, tests that prove they got it, and daily checklists that keep it happening — so the standard is the same on a Tuesday double as it is when you're watching.",
  },
  steps: [
    { title: "Built from your standards", body: "Upload an existing handbook or interview guide, or answer a short wizard. AI fills the gaps with hospitality best practices and writes a complete program for every role — not just a copy of what you already had." },
    { title: "Learn-then-quiz tests", body: "Turn any training into a read-then-test: staff study the material, then get quizzed and auto-scored, so they prove they learned the standard. Assign a test to a person, a role, or all staff with one click." },
    { title: "Daily checklists & pre-shift habits", body: "Opening and closing checklists per role, plus pre-shift rituals that keep the standard front of mind — the difference between a standard on paper and one that happens every shift." },
    { title: "Sign-offs & spot-checks", body: "Managers verify the moments guests actually feel with sign-offs and spot-checks, and coaching flags surface a slipping habit before it becomes normal." },
    { title: "English or Spanish, automatically", body: "Each person picks their language on first login and their training, tests, and checklists come through translated — the interface and your actual content — so the standard finally reaches your whole team." },
    { title: "One profile per person", body: "Training progress, tests passed, checklist completion, and their hiring scorecard all live on one profile — from their first interview onward, not three disconnected systems." },
  ],
  stats: [
    { value: "Every role", label: "A complete program per role, built from your standards — not a generic template." },
    { value: "Learn → prove", label: "Learn-then-quiz tests show who actually learned it, auto-scored." },
    { value: "EN / ES", label: "Training and checklists translated so the standard reaches everyone." },
  ],
  midCta: { headline: "Make your standard the standard — every shift.", sub: "See Wingman build a full training program from what you already have." },
  otherSystems: [
    { title: "Guest retention tracking", body: "The payoff of great service — turn first-time guests into regulars, visit by visit.", href: "/guest-retention-software" },
    { title: "Restaurant hiring", body: "Hire people who fit before you train them — applications, AI screening, careers page.", href: "/restaurant-hiring-software" },
    { title: "Guest reviews & feedback", body: "See whether the training is landing — surveys plus AI analysis of your Google reviews.", href: "/restaurant-review-management" },
  ],
  faqs: [
    { q: "Do I have to build the training from scratch?", a: "No. Upload an existing handbook, interview guide, or training doc and Wingman turns it into a structured program, filling gaps with hospitality best practices. No documents? A short wizard captures how you run things and it writes the program for you." },
    { q: "How do the tests work?", a: "Any training can become a learn-then-quiz: staff read the material, then take an auto-scored test. You assign it to a person, a role, or everyone, they take it a day at a time, and you see who passed — a missed deadline or a lock emails the manager automatically." },
    { q: "Does it work for staff who don't read English well?", a: "Yes. Each person selects their language on first login and their training, tests, and checklists are delivered translated — both the interface and your own content — so back-of-house isn't left guessing." },
    { q: "How is this different from a generic LMS?", a: "It's built for restaurants and tied to the rest of the operation: training connects to hiring scorecards, daily checklists, spot-checks, and ultimately guest retention. It's the standard in action, not a library of videos." },
    { q: "Can managers see who's behind?", a: "Yes. Every person's training progress, test scores, and checklist completion live on one profile, and managers get flagged on missed deadlines and slipping habits so they can coach in the moment." },
  ],
  finalCta: { headline: "Turn how you do things into how it's always done.", sub: "See Wingman build your training, tests, and daily habits from what you already have." },
};

export default function Page() {
  return <FeatureLandingPage config={config} />;
}
