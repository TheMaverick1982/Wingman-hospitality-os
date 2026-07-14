"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, GraduationCap, Pencil, Trash2, Plus, ClipboardList, ArrowRight } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { hiringGuidanceFor, type CoreValueRow } from "@/lib/hiring";
import { HiringTraitBuilder } from "./hiring-trait-builder";
import { RefineHiringForm } from "./refine-hiring-form";
import { addHiringTrait, updateHiringTrait, deleteHiringTrait, type TraitState } from "./hiring-builder-actions";

export type HiringTrait = {
  id: string;
  title: string;
  question: string;
  green_flag: string;
  red_flag: string;
  source: "wingman" | "custom";
};

const addInitial: TraitState = { error: null };

export function HiringClient({
  coreValues,
  traitsByDept,
  departments,
  canEdit,
}: {
  coreValues: CoreValueRow[];
  traitsByDept: Record<Department, HiringTrait[]>;
  departments: Department[];
  canEdit: boolean;
}) {
  const roles = departments.length ? departments : ALL_DEPARTMENTS;
  const [activeRole, setActiveRole] = useState<Department>(roles[0]);
  const activeTraits = traitsByDept[activeRole] ?? [];
  const combinedTraits = [
    ...coreValues.map((v) => ({ title: v.title, question: hiringGuidanceFor(v).question, universal: true })),
    ...activeTraits.map((t) => ({ title: t.title, question: t.question, universal: false })),
  ];

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {roles.map((d) => (
          <button
            key={d}
            onClick={() => setActiveRole(d)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
              activeRole === d ? "bg-charcoal text-white border-charcoal" : "bg-panel text-ink border-line"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-6">
        <InterviewGuideButton department={activeRole} traits={combinedTraits} />
        {canEdit && activeTraits.length > 0 && <RefineHiringForm department={activeRole} />}
        {canEdit && <HiringTraitBuilder department={activeRole} />}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Heart size={14} className="text-brick" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brick">
          Universal — every department is screened for this
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 mb-6">
        {coreValues.map((v) => {
          const g = hiringGuidanceFor(v);
          return (
            <div key={v.title} className="bg-panel border border-line rounded-2xl p-5">
              <p className="text-sm font-semibold mb-2 text-ink">{v.title}</p>
              <p className="text-sm mb-3 text-charcoal-2">&quot;{g.question}&quot;</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-olive-tint rounded-lg p-3">
                  <span className="text-xs font-semibold block mb-1 text-[#15803d]">Green flag</span>
                  <span className="text-xs text-[#15803d]">{g.green}</span>
                </div>
                <div className="bg-brick-tint rounded-lg p-3">
                  <span className="text-xs font-semibold block mb-1 text-brick-dark">Red flag</span>
                  <span className="text-xs text-brick-dark">{g.red}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GraduationCap size={14} className="text-gold" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#b45309]">
            {activeRole}-specific — what this department needs beyond hospitality
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <InterviewGuideButton department={activeRole} traits={combinedTraits} />
          {canEdit && activeTraits.length > 0 && <RefineHiringForm department={activeRole} />}
          {canEdit && <HiringTraitBuilder department={activeRole} />}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 mb-8">
        {activeTraits.map((t) => (
          <TraitCard key={t.id} trait={t} canEdit={canEdit} />
        ))}
        {canEdit && <AddTraitCard department={activeRole} />}
      </div>
    </div>
  );
}

function InterviewGuideButton({
  department,
  traits,
}: {
  department: Department;
  traits: { title: string; question: string; universal: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Btn small kind="ghost" icon={ClipboardList} onClick={() => setOpen(true)}>
        Interview guide
      </Btn>
      {open && (
        <Modal
          title={`${department} interview guide`}
          sub="Every question to ask, in order — walk through this live, then score the candidate."
          onClose={() => setOpen(false)}
        >
          <div className="flex flex-col gap-3 mb-5 max-h-[420px] overflow-y-auto pr-1">
            {traits.map((t, i) => (
              <div key={i} className={`p-3.5 rounded-xl border ${t.universal ? "border-line" : "border-[#ffcc80]"} bg-panel`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Pill tone={t.universal ? "brick" : "gold"}>{t.universal ? "Universal" : department}</Pill>
                  <span className="text-sm font-semibold text-ink">{t.title}</span>
                </div>
                <p className="text-sm text-charcoal-2">&quot;{t.question}&quot;</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Btn kind="ghost" onClick={() => setOpen(false)}>
              Close
            </Btn>
            <Btn
              icon={ArrowRight}
              onClick={() => {
                setOpen(false);
                router.push(`/hiring?scoreDept=${encodeURIComponent(department)}`);
              }}
            >
              Score this candidate
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

function TraitCard({ trait, canEdit }: { trait: HiringTrait; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(trait.title);
  const [question, setQuestion] = useState(trait.question);
  const [greenFlag, setGreenFlag] = useState(trait.green_flag);
  const [redFlag, setRedFlag] = useState(trait.red_flag);
  const [, startTransition] = useTransition();

  function save() {
    startTransition(() => updateHiringTrait(trait.id, { title, question, green_flag: greenFlag, red_flag: redFlag }));
    setEditing(false);
  }

  function remove() {
    startTransition(() => deleteHiringTrait(trait.id));
  }

  if (editing) {
    return (
      <div className="bg-panel border border-brick rounded-2xl p-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} mb-2 font-semibold`} placeholder="Trait title" />
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className={`${inputClass} mb-3 resize-none`}
          placeholder="Interview question"
        />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <textarea
            value={greenFlag}
            onChange={(e) => setGreenFlag(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="Green flag"
          />
          <textarea
            value={redFlag}
            onChange={(e) => setRedFlag(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="Red flag"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Btn small kind="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Btn>
          <Btn small onClick={save}>
            Save
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-line rounded-2xl p-5 group">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-ink">{trait.title}</p>
        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
          {trait.source === "custom" && <Pill tone="muted">Custom</Pill>}
          {canEdit && (
            <div className="hidden group-hover:flex items-center gap-2">
              <button onClick={() => setEditing(true)} className="text-muted-2 hover:text-ink">
                <Pencil size={13} />
              </button>
              <button onClick={remove} className="text-muted-2 hover:text-danger">
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-sm mb-3 text-charcoal-2">&quot;{trait.question}&quot;</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-olive-tint rounded-lg p-3">
          <span className="text-xs font-semibold block mb-1 text-[#15803d]">Green flag</span>
          <span className="text-xs text-[#15803d]">{trait.green_flag}</span>
        </div>
        <div className="bg-brick-tint rounded-lg p-3">
          <span className="text-xs font-semibold block mb-1 text-brick-dark">Red flag</span>
          <span className="text-xs text-brick-dark">{trait.red_flag}</span>
        </div>
      </div>
    </div>
  );
}

function AddTraitCard({ department }: { department: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addHiringTrait, addInitial);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 text-sm font-semibold text-brick border border-dashed border-line-strong rounded-2xl py-4 hover:bg-panel"
      >
        <Plus size={15} /> Add a trait
      </button>
    );
  }

  return (
    <form action={formAction} className="bg-panel border border-brick rounded-2xl p-5">
      <input type="hidden" name="department" value={department} />
      <input name="title" required className={`${inputClass} mb-2 font-semibold`} placeholder="Trait title" />
      <textarea name="question" required rows={2} className={`${inputClass} mb-3 resize-none`} placeholder="Interview question" />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <textarea name="greenFlag" rows={2} className={`${inputClass} resize-none`} placeholder="Green flag" />
        <textarea name="redFlag" rows={2} className={`${inputClass} resize-none`} placeholder="Red flag" />
      </div>
      {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Btn small type="button" kind="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Btn>
        <Btn small type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add trait"}
        </Btn>
      </div>
    </form>
  );
}
