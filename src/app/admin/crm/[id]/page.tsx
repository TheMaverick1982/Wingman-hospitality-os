import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { canAccessPlatformSection } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSalesReps } from "@/lib/sales-reps";
import { ContactPanel, type ContactRecord, type ActivityRecord, type EnrollmentRecord } from "./contact-panel";

export const metadata: Metadata = { title: "Contact · CRM" };

type PageView = { id: string; path: string; referrer: string | null; utm_source: string | null; created_at: string };

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// First-party site activity for a converted lead — the pages they viewed before /
// after converting, linked via their anonymous visitor id.
function SiteActivity({ views }: { views: PageView[] }) {
  if (views.length === 0) return null;
  const firstReferrer = [...views].reverse().find((v) => v.referrer)?.referrer ?? null;
  const firstUtm = [...views].reverse().find((v) => v.utm_source)?.utm_source ?? null;
  return (
    <div className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-ink">Site activity</h2>
        <span className="text-[12px] text-muted-2">{views.length} page view{views.length === 1 ? "" : "s"}</span>
      </div>
      {(firstReferrer || firstUtm) && (
        <p className="text-[12px] text-muted-2 mb-3">
          First arrived {firstUtm ? `via ${firstUtm}` : firstReferrer ? `from ${firstReferrer}` : ""}.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {views.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-4 py-2">
            <span className="text-[13px] font-medium text-charcoal-2 truncate">{v.path}</span>
            <span className="text-[12px] text-muted-2 whitespace-nowrap">{fmtWhen(v.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function CrmContactPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePlatformSection("crm");
  const canDelete = canAccessPlatformSection(me.platformAccess, "crm_delete");
  const { id } = await params;
  const admin = createAdminClient();

  const { data: contact } = await admin
    .from("crm_contacts")
    .select("id, email, name, phone, notes, stage, first_source, unsubscribed, booked_at, customer_at, org_id, assigned_rep_id, visitor_id, created_at, tags, sms_opt_out")
    .eq("id", id)
    .maybeSingle();
  if (!contact) notFound();
  const contactRow = contact as ContactRecord & { visitor_id: string | null };

  const reps = await listSalesReps();
  const [{ data: activities }, { data: enrollments }, { data: pageViews }] = await Promise.all([
    admin
      .from("crm_activities")
      .select("id, kind, subject, body, meta, created_at")
      .eq("contact_id", id)
      .order("created_at", { ascending: true })
      .limit(500),
    admin
      .from("crm_enrollments")
      .select("id, status, stopped_reason, next_run_at, crm_sequences(name, source)")
      .eq("contact_id", id)
      .order("enrolled_at", { ascending: false }),
    contactRow.visitor_id
      ? admin
          .from("site_page_views")
          .select("id, path, referrer, utm_source, created_at")
          .eq("visitor_id", contactRow.visitor_id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as PageView[] }),
  ]);
  const views = (pageViews ?? []) as PageView[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/crm" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition-colors w-fit">
          <ArrowLeft size={15} /> Back to pipeline
        </Link>
        <Link href={`/admin/conversations/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-lg px-3.5 py-2 hover:bg-brick-dark transition-colors">
          <MessageSquare size={14} /> Open conversation
        </Link>
      </div>
      <ContactPanel
        contact={contact as ContactRecord}
        activities={(activities ?? []) as ActivityRecord[]}
        enrollments={(enrollments ?? []) as unknown as EnrollmentRecord[]}
        canDelete={canDelete}
        reps={reps}
      />
      <SiteActivity views={views} />
    </div>
  );
}
