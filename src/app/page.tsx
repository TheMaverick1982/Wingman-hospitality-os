import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { StatsBand } from "@/components/marketing/stats-band";
import { ValueProps } from "@/components/marketing/value-props";
import { CustomSystem } from "@/components/marketing/custom-system";
import { RoleBasedTraining } from "@/components/marketing/role-based-training";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { QuoteSection } from "@/components/marketing/quote-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { InlineCta } from "@/components/marketing/inline-cta";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profile = await getCurrentProfile();
    redirect(profile ? "/dashboard" : "/onboarding");
  }

  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />
      <Hero />
      <StatsBand />
      <ValueProps />
      <InlineCta
        headline="See it running on your own floor."
        sub="Get your team started in minutes."
        spacingClassName="pb-20 sm:pb-32"
      />
      <CustomSystem />
      <InlineCta
        headline="Your neighborhood is a revenue channel."
        sub="Turn local businesses into catering, events, and fundraisers — worked like the pipeline it is."
      />
      <RoleBasedTraining />
      <HowItWorks />
      <InlineCta headline="Ready to set your standard?" sub="Takes minutes to get your team started." />
      <QuoteSection />
      <FaqSection />
      <CtaSection />
      <MarketingFooter />
    </div>
  );
}
