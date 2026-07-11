import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Set your standard in minutes. Create your Wingman workspace and go live on your first shift.",
  keywords: ["restaurant onboarding software", "start restaurant training program", "hospitality software signup"],
  alternates: { canonical: "/signup" },
  openGraph: {
    title: "Get Started | Wingman",
    description: "Set your standard in minutes. Go live on your first shift.",
    url: "/signup",
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
