import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Library } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getBrandLibrary } from "@/lib/franchise-brand";
import { BrandLibraryClient } from "./brand-library-client";

export const metadata = { title: "Brand Library — Wingman" };

export default async function BrandLibraryPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  // Only a franchisor admin can author/push brand content.
  if (!profile.franchiseGroupId || profile.franchiseRole !== "admin") redirect("/dashboard");

  const tests = await getBrandLibrary(profile.orgId, profile.franchiseGroupId);

  return (
    <>
      <div>
        <Link href="/franchise" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-2 hover:text-ink mb-3">
          <ArrowLeft size={14} /> Back to oversight
        </Link>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-ink text-white flex items-center justify-center shrink-0 mt-0.5">
            <Library size={20} />
          </div>
          <div>
            <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] text-ink mb-1">Brand Library</h1>
            <p className="text-base text-muted max-w-2xl">
              Push your training to every franchisee. Author a test in your own Training area, then push it — as a
              <span className="font-semibold text-ink"> locked brand standard</span> they can&rsquo;t edit, or an
              adaptable starting point. Re-push anytime to update everyone.
            </p>
          </div>
        </div>
      </div>

      <BrandLibraryClient tests={tests} />

      <p className="text-[12px] text-muted-2">
        Tests are authored in your own <Link href="/training/tests" className="text-brick font-semibold">Training</Link> and pushed from here.
        Hiring criteria and standards join the Brand Library next.
      </p>
    </>
  );
}
