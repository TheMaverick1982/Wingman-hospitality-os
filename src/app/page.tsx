import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { ValueProps } from "@/components/marketing/value-props";
import { HowItWorks } from "@/components/marketing/how-it-works";
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
      <ValueProps />
      <HowItWorks />
      <CtaSection />
      <MarketingFooter />
    </div>
  );
}
