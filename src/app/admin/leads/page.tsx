import Link from "next/link";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type Lead = {
  id: string;
  email: string;
  name: string | null;
  source: string;
  payload: Record<string, unknown>;
  created_at: string;
};

function summarize(l: Lead): string {
  const p = l.payload || {};
  if (l.source === "calculator") {
    const yr = typeof p.perYear === "number" ? `+$${Math.round(p.perYear).toLocaleString()}/yr` : "";
    return [`${p.current ?? "?"}%→${p.target ?? "?"}% repeat`, `$${p.check ?? "?"} check`, yr].filter(Boolean).join(" · ");
  }
  if (l.source === "scorecard") {
    return `Grade ${p.grade ?? "?"} · ${p.pct ?? "?"}%`;
  }
  return "";
}

export default async function AdminLeadsPage() {
  await requirePlatformSection("analytics");
  const admin = createAdminClient();

  const [{ data }, { data: contacts }, { data: enrolls }] = await Promise.all([
    admin.from("leads").select("id, email, name, source, payload, created_at").order("created_at", { ascending: false }).limit(500),
    admin.from("crm_contacts").select("id, email"),
    admin.from("crm_enrollments").select("contact_id, status, crm_sequences(name)").eq("status", "active"),
  ]);
  const leads = (data ?? []) as Lead[];

  // Map each lead email → the active sequence it's enrolled in (via its CRM contact).
  const contactIdByEmail = new Map<string, string>();
  for (const c of (contacts ?? []) as { id: string; email: string }[]) contactIdByEmail.set(c.email, c.id);
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
        <Link href="/admin/crm" className="text-sm font-semibold text-brick">
          Open the CRM pipeline →
        </Link>
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        {leads.length === 0 ? (
          <p className="text-sm text-muted p-6">No leads yet. They&apos;ll appear here as people use the demo, chat, calculator, and scorecard.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[12px] font-semibold uppercase tracking-wide text-muted-2 border-b border-line">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Automation</th>
                  <th className="px-5 py-3">Detail</th>
                  <th className="px-5 py-3 whitespace-nowrap">Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const seq = automationFor(l.email);
                  return (
                    <tr key={l.id} className="border-b border-[#F5F5F5] last:border-0">
                      <td className="px-5 py-3">
                        <div className="text-[14px] font-semibold text-ink">{l.name || "—"}</div>
                        <a href={`mailto:${l.email}`} className="text-[12.5px] text-brick hover:opacity-70">{l.email}</a>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[12px] font-semibold text-charcoal-2 bg-paper border border-line px-2 py-0.5 rounded-full capitalize">{l.source}</span>
                      </td>
                      <td className="px-5 py-3">
                        {seq ? (
                          <span className="text-[12px] font-medium text-olive bg-olive-tint px-2 py-0.5 rounded-full">{seq}</span>
                        ) : (
                          <span className="text-[13px] text-muted-2">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-charcoal-2">{summarize(l)}</td>
                      <td className="px-5 py-3 text-[13px] text-muted-2 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
