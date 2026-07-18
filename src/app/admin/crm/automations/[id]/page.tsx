import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { sourceLabel, sourceTrigger } from "@/lib/crm";
import { setSequencePublished, addStep } from "../actions";
import { StepEditor, type EditableStep } from "./step-editor";

export const metadata: Metadata = { title: "Edit sequence · CRM" };

export default async function EditSequencePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformSection("crm");
  const { id } = await params;
  const admin = createAdminClient();

  const { data: seq } = await admin.from("crm_sequences").select("id, source, name, active, published").eq("id", id).maybeSingle();
  if (!seq) notFound();
  const sequence = seq as { id: string; source: string; name: string; active: boolean; published: boolean };

  const { data: stepRows } = await admin
    .from("crm_sequence_steps")
    .select("id, step_order, delay_days, channel, subject, body, active")
    .eq("sequence_id", id)
    .order("step_order", { ascending: true });
  const steps = (stepRows ?? []) as EditableStep[];

  return (
    <div className="flex flex-col gap-5 max-w-[760px]">
      <Link href="/admin/crm/automations" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink w-fit">
        <ArrowLeft size={15} /> Back to automations
      </Link>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{sequence.name}</h1>
          <p className="text-sm text-muted mt-1">Nurtures leads from the {sourceLabel(sequence.source)} funnel. Days are counted from when they enter the sequence.</p>
          <p className="text-[13px] text-muted-2 mt-1">Use <code className="text-brick">{"{{first_name}}"}</code> for the contact&apos;s first name and <code className="text-brick">{"{{rep_name}}"}</code> for the assigned salesperson (great for signing demo emails). Steps can be email or SMS; SMS only reaches contacts who opted in to marketing texts.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${sequence.published ? "text-olive bg-olive-tint" : "text-[#b4884a] bg-gold-tint"}`}>
            {sequence.published ? "Published" : "Draft"}
          </span>
          <form action={setSequencePublished}>
            <input type="hidden" name="sequenceId" value={sequence.id} />
            <input type="hidden" name="published" value={(!sequence.published).toString()} />
            <button type="submit" className={`text-[13px] font-semibold px-3.5 py-2 rounded-lg transition-colors ${sequence.published ? "bg-paper border border-line text-charcoal-2 hover:bg-white" : "bg-brick text-white hover:bg-brick-dark"}`}>
              {sequence.published ? "Unpublish" : "Publish"}
            </button>
          </form>
        </div>
      </div>

      {sourceTrigger(sequence.source) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-paper px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-brick mt-0.5 shrink-0">Trigger</span>
          <p className="text-sm text-charcoal-2 leading-[1.5]">{sourceTrigger(sequence.source)}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {steps.map((step, idx) => (
          <StepEditor
            key={step.id}
            step={step}
            sequenceId={sequence.id}
            isFirst={idx === 0}
            isLast={idx === steps.length - 1}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <form action={addStep}>
          <input type="hidden" name="sequenceId" value={sequence.id} />
          <button type="submit" className="text-[13px] font-semibold text-ink bg-paper border border-line-strong rounded-lg px-4 py-2 hover:bg-white transition-colors">
            + Add step at the end
          </button>
        </form>
        <p className="text-[12px] text-muted-2">Use the ↑ ↓ on a card to reorder, or + to insert a step below it.</p>
      </div>
    </div>
  );
}
