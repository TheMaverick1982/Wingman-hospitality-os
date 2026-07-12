import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { PrintShell } from "../print-shell";

type Item = { checklist_type: string; item: string; sort_order: number };

function ChecklistSection({ title, rows }: { title: string; rows: Item[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="avoid-break mb-6">
      <h2 className="text-[19px] font-bold text-ink border-b border-line pb-1.5 mb-2.5">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[14px] text-ink">
            <span className="mt-0.5 inline-block w-4 h-4 border border-charcoal-2 rounded-[3px] shrink-0" />
            <span>{r.item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PrintAccountabilityPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("accountability_checklist_items")
    .select("checklist_type, item, sort_order")
    .order("sort_order");
  const items = (data ?? []) as Item[];
  const preshift = items.filter((i) => i.checklist_type === "preshift");
  const daily = items.filter((i) => i.checklist_type === "daily");

  return (
    <PrintShell title="Shift Checklists" subtitle="Run these every shift. Inspect what you expect." orgName={profile.orgName}>
      {items.length === 0 ? (
        <p className="text-[14px] text-muted">No checklist items yet — build them in Accountability.</p>
      ) : (
        <>
          <ChecklistSection title="Pre-shift checklist" rows={preshift} />
          <ChecklistSection title="Daily / close checklist" rows={daily} />
          <div className="avoid-break flex gap-8 mt-8 text-[13px] text-muted-2">
            <div className="flex-1 border-t border-charcoal-2 pt-1.5">Manager on duty</div>
            <div className="flex-1 border-t border-charcoal-2 pt-1.5">Date</div>
          </div>
        </>
      )}
    </PrintShell>
  );
}
