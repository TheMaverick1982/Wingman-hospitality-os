import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { ContactPanel, type ContactRecord, type ActivityRecord, type EnrollmentRecord } from "./contact-panel";

export const metadata: Metadata = { title: "Contact · CRM" };

export default async function CrmContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformSection("crm");
  const { id } = await params;
  const admin = createAdminClient();

  const { data: contact } = await admin
    .from("crm_contacts")
    .select("id, email, name, phone, notes, stage, first_source, unsubscribed, booked_at, customer_at, org_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!contact) notFound();

  const [{ data: activities }, { data: enrollments }] = await Promise.all([
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
  ]);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/crm" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition-colors w-fit">
        <ArrowLeft size={15} /> Back to pipeline
      </Link>
      <ContactPanel
        contact={contact as ContactRecord}
        activities={(activities ?? []) as ActivityRecord[]}
        enrollments={(enrollments ?? []) as unknown as EnrollmentRecord[]}
      />
    </div>
  );
}
