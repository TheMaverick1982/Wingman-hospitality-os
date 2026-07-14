import { getCurrentProfile } from "@/lib/auth/profile";
import { getChecklistItems, type ChecklistType } from "@/app/(app)/accountability/template-actions";
import { PrintShell } from "../print-shell";

// The checklists that can be printed, in print order. Kept in sync with the
// selector on the Accountability page.
const PRINTABLE: { type: ChecklistType; title: string }[] = [
  { type: "daily", title: "Manager daily checklist" },
  { type: "preshift", title: "Pre-shift checklist" },
  { type: "server", title: "Server standards checklist" },
  { type: "loyalty", title: "FOH loyalty checklist" },
];
const VALID = new Set(PRINTABLE.map((p) => p.type));

function ChecklistSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="avoid-break mb-6">
      <h2 className="text-[19px] font-bold text-ink border-b border-line pb-1.5 mb-2.5">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[14px] text-ink">
            <span className="mt-0.5 inline-block w-4 h-4 border border-charcoal-2 rounded-[3px] shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PrintAccountabilityPage({ searchParams }: { searchParams: Promise<{ lists?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  // ?lists=daily,preshift,... selects which checklists to include; absent = all.
  const { lists } = await searchParams;
  const requested = lists
    ? lists.split(",").map((s) => s.trim()).filter((s) => VALID.has(s as ChecklistType))
    : PRINTABLE.map((p) => p.type);
  const chosen = PRINTABLE.filter((p) => requested.includes(p.type));

  // Load each selected checklist's items — falls back to the built-in defaults
  // when an org hasn't customized that list, so the print is never blank.
  const sections = await Promise.all(
    chosen.map(async (c) => ({ title: c.title, items: (await getChecklistItems(c.type)).map((i) => i.item) }))
  );
  const hasAny = sections.some((s) => s.items.length > 0);

  return (
    <PrintShell title="Shift Checklists" subtitle="Run these every shift. Inspect what you expect." orgName={profile.orgName}>
      {!hasAny ? (
        <p className="text-[14px] text-muted">No checklist items to print — build them in Accountability, or pick different checklists.</p>
      ) : (
        <>
          {sections.map((s) => (
            <ChecklistSection key={s.title} title={s.title} items={s.items} />
          ))}
          <div className="avoid-break flex gap-8 mt-8 text-[13px] text-muted-2">
            <div className="flex-1 border-t border-charcoal-2 pt-1.5">Signature</div>
            <div className="flex-1 border-t border-charcoal-2 pt-1.5">Date</div>
          </div>
        </>
      )}
    </PrintShell>
  );
}
