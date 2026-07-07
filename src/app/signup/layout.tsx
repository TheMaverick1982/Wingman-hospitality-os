import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Set your standard in minutes. Create your Wingman workspace — no credit card required.",
  keywords: ["restaurant onboarding software", "start restaurant training program", "hospitality software signup"],
  alternates: { canonical: "/signup" },
  openGraph: {
    title: "Get Started | Wingman",
    description: "Set your standard in minutes. No credit card required.",
    url: "/signup",
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
