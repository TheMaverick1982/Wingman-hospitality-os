import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { BILLING_OWNER_EMAIL } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeletedLeadsTable, type DeletedLeadRow } from "./deleted-leads-table";

export const metadata: Metadata = { title: "Deleted Leads · Admin" };

export default async function DeletedLeadsPage() {
  const profile = await requirePlatformSection("analytics");
  // Owner-only view (brian@brianhardy.com).
  if (profile.email !== BILLING_OWNER_EMAIL) redirect("/admin/leads");

  const admin = createAdminClient();
  const { data } = await admin
    .from("leads")
    .select("id, email, name, source, created_at, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as DeletedLeadRow[];

  return (
    <>
      <div className="mb-6">
        <Link href="/admin/leads" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink transition-colors mb-3">
          <ArrowLeft size={16} strokeWidth={2} />
          Back to Leads
        </Link>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Deleted Leads</h1>
        <p className="text-base text-muted">
          {rows.length} deleted {rows.length === 1 ? "lead" : "leads"} · owner-only. Restore a lead to return it to the main list.
        </p>
      </div>

      <DeletedLeadsTable rows={rows} />
    </>
  );
}
