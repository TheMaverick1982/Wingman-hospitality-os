import Link from "next/link";
import { cookies } from "next/headers";
import { Check } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";

export const metadata = {
  title: "Connect Clover — Wingman",
  robots: { index: false, follow: false },
};

// Landing page after a merchant installs Wingman from the Clover App Market.
// The store's token has already been captured (pending install); here we confirm
// it and route them to sign in / sign up, after which the app shell finalizes
// the link to their org automatically.
export default async function CloverWelcomePage() {
  const jar = await cookies();
  const nonce = jar.get("clover_pending")?.value;

  let merchantName = "";
  if (nonce) {
    const admin = createAdminClient();
    const { data } = await admin.from("clover_pending_installs").select("merchant_name").eq("id", nonce).maybeSingle();
    merchantName = (data as { merchant_name?: string } | null)?.merchant_name ?? "";
  }

  const profile = await getCurrentProfile();
  const signedIn = Boolean(profile);
  const store = merchantName || "Your Clover store";

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md bg-white border border-line rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#E7F6EC] text-[#15803D] flex items-center justify-center mx-auto mb-5">
          <Check size={26} />
        </div>
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-ink mb-2">{store} is connected to Wingman</h1>
        <p className="text-[15px] text-muted leading-relaxed mb-6">
          {nonce
            ? "One more step — sign in to your Wingman account (or create one) and we'll finish linking your store. From then on, your customers sync into guest retention and your sales flow into Business Health, automatically."
            : "Sign in to your Wingman account to connect your Clover store. Your customers will sync into guest retention and your sales into Business Health, automatically."}
        </p>

        {signedIn ? (
          <Link
            href="/settings?tab=api"
            className="inline-flex items-center justify-center w-full rounded-xl bg-brick text-white text-[15px] font-semibold px-5 py-3 hover:bg-brick-dark transition-colors"
          >
            Continue to Wingman
          </Link>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full rounded-xl bg-brick text-white text-[15px] font-semibold px-5 py-3 hover:bg-brick-dark transition-colors"
            >
              Log in to finish
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center w-full rounded-xl border border-line text-ink text-[15px] font-semibold px-5 py-3 hover:border-brick hover:text-brick transition-colors"
            >
              Create a Wingman account
            </Link>
          </div>
        )}

        <p className="text-[12.5px] text-muted-2 mt-6">
          Wingman reads your Clover data (customers &amp; sales) read-only and never touches payments. Billing is
          separate from Clover.
        </p>
      </div>
    </div>
  );
}
