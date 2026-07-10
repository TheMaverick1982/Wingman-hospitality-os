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
  const { data } = await admin
    .from("leads")
    .select("id, email, name, source, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const leads = (data ?? []) as Lead[];

  const bySource = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.source] = (acc[l.source] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Leads</h1>
        <p className="text-base text-muted">
          {leads.length} captured{" "}
          {Object.entries(bySource).length > 0 && (
            <span className="text-muted-2">· {Object.entries(bySource).map(([s, n]) => `${n} ${s}`).join(" · ")}</span>
          )}
        </p>
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        {leads.length === 0 ? (
          <p className="text-sm text-muted p-6">No leads yet. They&apos;ll appear here as people use the calculator and scorecard.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[12px] font-semibold uppercase tracking-wide text-muted-2 border-b border-line">
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Detail</th>
                  <th className="px-5 py-3 whitespace-nowrap">Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-[#F5F5F5] last:border-0">
                    <td className="px-5 py-3">
                      <a href={`mailto:${l.email}`} className="text-[14px] font-medium text-brick hover:opacity-70">{l.email}</a>
                      {l.name && <div className="text-[12.5px] text-muted-2">{l.name}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[12px] font-semibold text-charcoal-2 bg-paper border border-line px-2 py-0.5 rounded-full capitalize">{l.source}</span>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-charcoal-2">{summarize(l)}</td>
                    <td className="px-5 py-3 text-[13px] text-muted-2 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[13px] text-muted-2 mt-4">Structured for export — these can be forwarded to GoHighLevel to trigger sales automations.</p>
    </>
  );
}
