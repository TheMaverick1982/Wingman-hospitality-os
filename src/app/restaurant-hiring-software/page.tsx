import type { Metadata } from "next";
import { FeatureLandingPage, type FeatureLandingConfig } from "@/components/marketing/feature-landing";
import { HiringVisual } from "@/components/marketing/feature-visuals";

export const metadata: Metadata = {
  title: "Restaurant Hiring Software",
  description:
    "Wingman's restaurant hiring system: a customizable application form, AI pre-interview screening that grades candidates, trackable job openings, a public careers page with Google Jobs, and interview scheduling — one pipeline from applicant to hired.",
  keywords: [
    "restaurant hiring software",
    "restaurant applicant tracking system",
    "restaurant job application form",
    "hire restaurant staff",
    "restaurant recruiting software",
    "restaurant careers page",
  ],
  alternates: { canonical: "/restaurant-hiring-software" },
  openGraph: {
    title: "Restaurant Hiring Software | Wingman",
    description: "Collect applications, screen candidates with AI, post trackable openings, and hire — all in one pipeline built for restaurants.",
    url: "/restaurant-hiring-software",
    type: "website",
  },
};

const config: FeatureLandingConfig = {
  slug: "restaurant-hiring-software",
  eyebrow: "Restaurant hiring software",
  h1: "Hire restaurant staff who actually fit.",
  subhead:
    "A complete hiring pipeline built for restaurants — a branded application form, AI that screens candidates before you spend an interview slot, trackable job postings, and a public careers page that lands you in Google Jobs.",
  heroVisual: <HiringVisual />,
  problem: {
    heading: "Hiring in hospitality is a flood of DMs, texts, and no-shows.",
    body: "Applications land in five different inboxes, you interview people who were never a fit, and the good ones slip away while you're buried in the bad ones. Wingman turns it into one tracked pipeline — from the first application to the day they start — so you spend your time only on the people worth meeting.",
  },
  steps: [
    { title: "A ready-made application form", body: "Share a link or embed it on your own site — no careers page or subdomain needed. Fully customizable: turn fields on/off, rename them, and add your own questions. Answers show right on each applicant's card." },
    { title: "AI pre-interview screening", body: "Per role, Wingman drafts a few short questions grounded in your hiring criteria, then grades each applicant's written answers — a Strong fit / Worth a look / Probably pass read, with a score for guest-experience instinct and following instructions. You decide who's worth an interview before spending a slot." },
    { title: "Trackable job openings", body: "Post a role for a location (or several at once), let AI write the full job ad from your standards, and get a short branded link plus a QR code. Wingman counts clicks vs. applications per posting, so you see which board actually works." },
    { title: "A public careers page + Google Jobs", body: "Every open role auto-populates one branded careers page, marked up so your jobs can appear in the Google Jobs results box — free applicant traffic most restaurants never tap. Each role has its own page and apply link." },
    { title: "Interviews & scoring in one place", body: "Schedule and confirm interviews (with a same-day reminder to each location), score candidates against your criteria after the interview, and move the best straight into your team — their scorecard follows them into training." },
    { title: "See where applicants come from", body: "Tag your apply link per channel (Craigslist, Facebook, Indeed) and every application shows its source — so you learn not just how many each channel sends, but how good they are." },
  ],
  stats: [
    { value: "1 pipeline", label: "Every applicant in one place — no more scattered inboxes and lost texts." },
    { value: "Before the interview", label: "AI screening tells you who's worth meeting, so you stop wasting slots." },
    { value: "Google Jobs", label: "Your openings eligible for free applicant traffic from Google search." },
  ],
  midCta: { headline: "Turn hiring from a scramble into a system.", sub: "See the whole applicant pipeline on your own openings." },
  otherSystems: [
    { title: "Guest retention tracking", body: "Turn first-time guests into regulars, visit by visit — the core of what Wingman does.", href: "/guest-retention-software" },
    { title: "Staff training & standards", body: "Role-based training, tests, and daily checklists that hold your standard every shift.", href: "/restaurant-training-software" },
    { title: "Guest reviews & feedback", body: "First-party surveys plus AI analysis of your Google reviews, all in one place.", href: "/restaurant-review-management" },
  ],
  faqs: [
    { q: "Do I need a website or careers page to collect applications?", a: "No. Wingman gives you a ready-made application form with a shareable link, and a public careers page that populates automatically from your open roles. If you do have a site, you can embed the form or careers page with one snippet." },
    { q: "How does the AI screening work?", a: "For each role, Wingman drafts a few short questions grounded in your own hiring criteria — guest-experience scenarios plus one that quietly checks whether the candidate follows directions. When someone applies, it grades their written answers into a fit tier with a short reason. It's decision support: it never auto-rejects, and the manager always decides." },
    { q: "Can my job postings show up on Google Jobs?", a: "Yes. Every open role gets its own page with proper JobPosting structured data, and they're all in the sitemap — so your openings are eligible to appear in the Google Jobs results box, which is free applicant traffic." },
    { q: "Can I hire for a role that isn't in the list?", a: "Yes — pick \"Custom role\" and type any position (Baker, Valet, Event Lead). It flows through the ad, careers page, and screening just like a standard role." },
    { q: "What happens after I hire someone?", a: "They move straight from candidate into your team, and their hiring scorecard follows them into training — one profile per person from the first interview onward, not three separate systems." },
  ],
  finalCta: { headline: "Build a hiring pipeline that finds the right people.", sub: "Collect, screen, and hire restaurant staff in one system — see it on your own openings." },
};

export default function Page() {
  return <FeatureLandingPage config={config} />;
}
