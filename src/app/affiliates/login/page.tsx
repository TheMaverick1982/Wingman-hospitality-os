import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { AffiliateLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Affiliate Login",
  alternates: { canonical: "/affiliates/login" },
  robots: { index: false, follow: true },
};

export default function AffiliateLoginPage() {
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />
      <div className="flex-1 bg-paper">
        <div className="max-w-[440px] mx-auto px-6 py-20 sm:py-28">
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink mb-1.5 text-center">Affiliate login</h1>
          <p className="text-[15px] text-muted text-center mb-8">Sign in to your affiliate dashboard.</p>
          <div className="bg-white border border-line rounded-[22px] p-7 shadow-sm">
            <AffiliateLoginForm />
          </div>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
