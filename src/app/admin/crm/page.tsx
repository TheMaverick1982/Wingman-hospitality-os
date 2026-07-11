import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { CRM_STAGES } from "@/lib/crm";
import { PipelineBoard, type BoardContact } from "./pipeline-board";
import { CrmTabs } from "./crm-tabs";

export const metadata: Metadata = { title: "CRM" };

function weekAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export default async function CrmPage() {
  await requirePlatformSection("crm");
  const admin = createAdminClient();

  const { data } = await admin
    .from("crm_contacts")
    .select("id, email, name, stage, first_source, unsubscribed, last_activity_at")
    .order("last_activity_at", { ascending: false })
    .limit(2000);
  const contacts = (data ?? []) as BoardContact[];

  const weekAgo = weekAgoIso();
  const newThisWeek = contacts.filter((c) => c.last_activity_at >= weekAgo).length;
  const signedUp = contacts.filter((c) => c.stage === "signed_up").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">CRM</h1>
          <p className="text-sm text-muted mt-1">Every lead from your funnels, in one pipeline. Drag a card to move it through the stages.</p>
        </div>
        <div className="flex gap-3">
          {[
            { label: "Contacts", value: contacts.length },
            { label: "Active this week", value: newThisWeek },
            { label: "Signed up", value: signedUp },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-line rounded-2xl px-5 py-3 min-w-[120px]">
              <div className="text-[26px] font-semibold tracking-[-0.02em] text-ink leading-none">{s.value}</div>
              <div className="text-[12px] text-muted mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <CrmTabs />

      {contacts.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-sm text-muted">
          No contacts yet. New leads from the demo, sales chat, calculator, and scorecard will appear here automatically.
        </div>
      ) : (
        <PipelineBoard contacts={contacts} stages={CRM_STAGES} />
      )}
    </div>
  );
}
