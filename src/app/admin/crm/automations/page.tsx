import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { sourceLabel } from "@/lib/crm";
import { ResyncButton } from "./resync-button";

export const metadata: Metadata = { title: "Automations · CRM" };

export default async function AutomationsPage() {
  await requirePlatformSection("crm");
  const admin = createAdminClient();

  const [{ data: sequences }, { data: steps }, { data: enrolls }] = await Promise.all([
    admin.from("crm_sequences").select("id, source, name, active, published").order("source", { ascending: true }),
    admin.from("crm_sequence_steps").select("sequence_id, active"),
    admin.from("crm_enrollments").select("sequence_id, status"),
  ]);

  const stepCount = new Map<string, number>();
  for (const s of (steps ?? []) as { sequence_id: string; active: boolean }[]) {
    if (s.active) stepCount.set(s.sequence_id, (stepCount.get(s.sequence_id) ?? 0) + 1);
  }
  const activeEnroll = new Map<string, number>();
  for (const e of (enrolls ?? []) as { sequence_id: string; status: string }[]) {
    if (e.status === "active") activeEnroll.set(e.sequence_id, (activeEnroll.get(e.sequence_id) ?? 0) + 1);
  }

  const list = (sequences ?? []) as { id: string; source: string; name: string; active: boolean; published: boolean }[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Automations</h1>
          <p className="text-sm text-muted mt-1">Nurture sequences that email each lead based on the funnel they came in through.</p>
        </div>
        <ResyncButton />
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs font-semibold uppercase tracking-wide text-muted-2">
              <th className="px-5 py-3">Sequence</th>
              <th className="px-5 py-3">Funnel</th>
              <th className="px-5 py-3">Steps</th>
              <th className="px-5 py-3">Currently enrolled</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-5 py-4 font-semibold text-ink">{s.name}</td>
                <td className="px-5 py-4 text-charcoal-2">{sourceLabel(s.source)}</td>
                <td className="px-5 py-4 text-charcoal-2">{stepCount.get(s.id) ?? 0}</td>
                <td className="px-5 py-4 text-charcoal-2">{activeEnroll.get(s.id) ?? 0}</td>
                <td className="px-5 py-4">
                  <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${s.published ? "text-olive bg-olive-tint" : "text-[#b4884a] bg-gold-tint"}`}>
                    {s.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <Link href={`/admin/crm/automations/${s.id}`} className="text-sm font-semibold text-brick">
                    Edit →
                  </Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  No sequences yet. Seed them via <code>/api/crm/seed-nurtures</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-muted-2">
        Sequences auto-stop when a contact books a call, becomes a customer, or unsubscribes. Steps send hourly via the CRM cron, within the Mon–Sat 7am–7pm (contact&rsquo;s ET) send window — except transactional first emails, which go out immediately. SMS steps only reach contacts who opted in to marketing texts and haven&rsquo;t replied STOP.
      </p>
    </div>
  );
}
