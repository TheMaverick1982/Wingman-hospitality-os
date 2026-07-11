import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { sourceLabel } from "@/lib/crm";
import { setSequenceActive, updateStep, addStep, deleteStep } from "../actions";

export const metadata: Metadata = { title: "Edit sequence · CRM" };

type Step = { id: string; step_order: number; delay_days: number; subject: string; body: string; active: boolean };

export default async function EditSequencePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformSection("crm");
  const { id } = await params;
  const admin = createAdminClient();

  const { data: seq } = await admin.from("crm_sequences").select("id, source, name, active").eq("id", id).maybeSingle();
  if (!seq) notFound();
  const sequence = seq as { id: string; source: string; name: string; active: boolean };

  const { data: stepRows } = await admin
    .from("crm_sequence_steps")
    .select("id, step_order, delay_days, subject, body, active")
    .eq("sequence_id", id)
    .order("step_order", { ascending: true });
  const steps = (stepRows ?? []) as Step[];

  return (
    <div className="flex flex-col gap-5 max-w-[760px]">
      <Link href="/admin/crm/automations" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink w-fit">
        <ArrowLeft size={15} /> Back to automations
      </Link>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{sequence.name}</h1>
          <p className="text-sm text-muted mt-1">Nurtures leads from the {sourceLabel(sequence.source)} funnel. Days are counted from when they enter the sequence.</p>
          <p className="text-[13px] text-muted-2 mt-1">Use <code className="text-brick">{"{{first_name}}"}</code> to personalize — it becomes their first name, or &ldquo;there&rdquo; if it&apos;s missing or inappropriate.</p>
        </div>
        <form action={setSequenceActive}>
          <input type="hidden" name="sequenceId" value={sequence.id} />
          <input type="hidden" name="active" value={(!sequence.active).toString()} />
          <button type="submit" className={`text-[13px] font-semibold px-3.5 py-2 rounded-lg transition-colors ${sequence.active ? "bg-paper border border-line text-charcoal-2 hover:bg-white" : "bg-brick text-white hover:bg-brick-dark"}`}>
            {sequence.active ? "Pause sequence" : "Activate sequence"}
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-4">
        {steps.map((step) => (
          <form key={step.id} action={updateStep} className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3">
            <input type="hidden" name="stepId" value={step.id} />
            <input type="hidden" name="sequenceId" value={sequence.id} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-2">Email {step.step_order}</span>
              <label className="flex items-center gap-2 text-[13px] text-charcoal-2">
                Send on day
                <input name="delay_days" type="number" min={0} defaultValue={step.delay_days} className="w-16 text-sm bg-paper border border-line rounded-lg px-2 py-1.5 outline-none focus:border-brick text-ink" />
              </label>
            </div>
            <input
              name="subject"
              defaultValue={step.subject}
              placeholder="Subject"
              className="text-sm font-medium bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink"
            />
            <textarea
              name="body"
              defaultValue={step.body}
              rows={5}
              className="text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink resize-y font-[inherit]"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[13px] text-charcoal-2">
                <input type="checkbox" name="active" defaultChecked={step.active} className="accent-brick" />
                Active
              </label>
              <div className="flex items-center gap-2">
                <button type="submit" className="text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-2 hover:bg-brick-dark transition-colors">
                  Save
                </button>
              </div>
            </div>
          </form>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <form action={addStep}>
          <input type="hidden" name="sequenceId" value={sequence.id} />
          <button type="submit" className="text-[13px] font-semibold text-ink bg-paper border border-line-strong rounded-lg px-4 py-2 hover:bg-white transition-colors">
            + Add email
          </button>
        </form>
        {steps.length > 0 && (
          <form action={deleteStep}>
            <input type="hidden" name="stepId" value={steps[steps.length - 1].id} />
            <input type="hidden" name="sequenceId" value={sequence.id} />
            <button type="submit" className="text-[13px] font-medium text-danger hover:opacity-70 transition-opacity">
              Remove last email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
