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
import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingFooter } from "@/components/marketing/footer";

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
    <div className="flex-1 flex flex-col">
      <MarketingNav />
      <Hero />
      <StatsBand />
      <ValueProps />
      <CustomSystem />
      <RoleBasedTraining />
      <HowItWorks />
      <QuoteSection />
      <CtaSection />
      <MarketingFooter />
    </div>
  );
}
