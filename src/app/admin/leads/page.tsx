import Link from "next/link";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { BILLING_OWNER_EMAIL } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadsTable, type LeadRow } from "./leads-table";

export const maxDuration = 60;

type Lead = {
  id: string;
  email: string;
  name: string | null;
  source: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export default async function AdminLeadsPage() {
  const profile = await requirePlatformSection("analytics");
  const isOwner = profile.email === BILLING_OWNER_EMAIL;
  const admin = createAdminClient();

  const [{ data }, { data: contacts }, { data: enrolls }] = await Promise.all([
    admin.from("leads").select("id, email, name, source, payload, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
    admin.from("crm_contacts").select("id, email, stage"),
    admin.from("crm_enrollments").select("contact_id, status, crm_sequences(name)").eq("status", "active"),
  ]);
  const leads = (data ?? []) as Lead[];

  // Map each lead email → its CRM contact (id + stage). Stage drives the
  // "Customers" smart list (signed_up), matching the Pipeline contacts list.
  const contactByEmail = new Map<string, { id: string; stage: string }>();
  for (const c of (contacts ?? []) as { id: string; email: string; stage: string }[]) contactByEmail.set(c.email, { id: c.id, stage: c.stage });
  const contactIdByEmail = new Map<string, string>();
  for (const [email, c] of contactByEmail) contactIdByEmail.set(email, c.id);
  const seqByContact = new Map<string, string>();
  for (const e of (enrolls ?? []) as unknown as { contact_id: string; crm_sequences: { name: string } | null }[]) {
    if (e.crm_sequences?.name) seqByContact.set(e.contact_id, e.crm_sequences.name);
  }
  const automationFor = (email: string): string | null => {
    const id = contactIdByEmail.get(email.toLowerCase());
    return id ? seqByContact.get(id) ?? null : null;
  };

  const bySource = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.source] = (acc[l.source] ?? 0) + 1;
    return acc;
  }, {});

  const rows: LeadRow[] = leads.map((l) => {
    const c = contactByEmail.get(l.email.toLowerCase());
    return {
      id: l.id,
      name: l.name,
      email: l.email,
      source: l.source,
      payload: l.payload,
      created_at: l.created_at,
      automation: automationFor(l.email),
      contactId: c?.id ?? null,
      isCustomer: c?.stage === "signed_up",
    };
  });

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Leads</h1>
          <p className="text-base text-muted">
            {leads.length} captured{" "}
            {Object.entries(bySource).length > 0 && (
              <span className="text-muted-2">· {Object.entries(bySource).map(([s, n]) => `${n} ${s}`).join(" · ")}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isOwner && (
            <Link href="/admin/leads/deleted" className="text-sm font-semibold text-muted hover:text-ink transition-colors">
              Deleted leads
            </Link>
          )}
          <Link href="/admin/crm" className="text-sm font-semibold text-brick">
            Open the CRM pipeline →
          </Link>
        </div>
      </div>

      <LeadsTable rows={rows} isOwner={isOwner} />
    </>
  );
}
