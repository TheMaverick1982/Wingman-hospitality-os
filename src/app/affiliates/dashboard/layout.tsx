import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { createClient } from "@/lib/supabase/server";
import { getAffiliateForUser } from "@/lib/affiliate";
import { affiliateLogout } from "../actions";

export const metadata: Metadata = {
  title: "Affiliate Dashboard",
  robots: { index: false, follow: false },
};

export default async function AffiliateDashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const affiliate = await getAffiliateForUser(supabase);
  if (!affiliate) redirect("/affiliates/login");

  return (
    <div className="min-h-full flex flex-col force-light bg-paper">
      <header className="bg-white border-b border-line">
        <div className="max-w-[880px] mx-auto px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <WingmanLogo className="h-6 w-auto" />
            <span className="text-[13px] font-semibold text-brick border-l border-line pl-2.5">Affiliates</span>
          </div>
          <form action={affiliateLogout}>
            <button type="submit" className="text-[13px] font-semibold text-muted hover:text-ink">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-[880px] mx-auto px-6 py-10">{children}</div>
      </main>
    </div>
  );
}
