import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";

// Minimal, sidebar-free layout for printable documents. Auth-gated (managers/
// owners reach these from each section). Print CSS hides the on-screen toolbar
// and sets clean page margins.
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen bg-[#F4F4F4] force-light">
      <style>{`
        @page { margin: 14mm; }
        .print-doc { max-width: 820px; margin: 0 auto; }
        .doc-body { background: #fff; padding: 32px 40px 40px; }
        @media screen { .doc-body { margin: 0 16px 40px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); } }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-doc { max-width: none; }
          .doc-body { box-shadow: none; margin: 0; padding: 0; border-radius: 0; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>
      {children}
    </div>
  );
}
