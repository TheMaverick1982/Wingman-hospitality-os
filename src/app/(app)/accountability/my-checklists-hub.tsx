"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ClipboardList } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { t as translate, type Lang } from "@/lib/i18n";
import { completeMyCustomChecklist, type PreshiftState } from "./shift-checklist-actions";
import { networkSafeAction, NETWORK_ERROR_MESSAGE } from "@/lib/network-safe-action";

const initialState: PreshiftState = { error: null };

export type HubChecklist = {
  key: string; // checklist_type or custom id
  title: string;
  items: string[];
  done: boolean;
  completedChecked: boolean[];
  completedAt: string | null;
};

// One staff-facing hub for every checklist assigned to the viewer — a picker
// where each checklist expands to be completed. Replaces the separate stacked
// cards so someone with several checklists sees one clean list.
export function MyChecklistsHub({ checklists, lang = "en" }: { checklists: HubChecklist[]; lang?: Lang }) {
  const tr = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  const firstOpen = checklists.find((c) => !c.done)?.key ?? checklists[0]?.key ?? null;
  const [openKey, setOpenKey] = useState<string | null>(firstOpen);

  if (checklists.length === 0) return null;
  const doneCount = checklists.filter((c) => c.done).length;

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-brick" />
          <h3 className="text-[16px] font-semibold text-ink">{tr("checklist.hub.title")}</h3>
        </div>
        <span className="text-[13px] font-semibold text-muted-2">
          {tr("checklist.hub.progress", { done: doneCount, total: checklists.length })}
        </span>
      </div>

      <div className="flex flex-col divide-y divide-line border border-line rounded-xl overflow-hidden">
        {checklists.map((c) => (
          <ChecklistRow key={c.key} data={c} lang={lang} open={openKey === c.key} onToggle={() => setOpenKey(openKey === c.key ? null : c.key)} />
        ))}
      </div>
    </div>
  );
}

function ChecklistRow({ data, lang, open, onToggle }: { data: HubChecklist; lang: Lang; open: boolean; onToggle: () => void }) {
  const tr = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  const [state, formAction, pending] = useActionState(networkSafeAction(completeMyCustomChecklist, (s) => ({ ...s, error: NETWORK_ERROR_MESSAGE })), initialState);
  const done = data.done || Boolean(state.done);

  return (
    <div className="bg-white">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-paper transition-colors">
        {done ? <CheckCircle2 size={18} className="text-[#15803d] shrink-0" /> : <Circle size={18} className="text-muted-2 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold text-ink truncate">{data.title}</div>
          <div className="text-[12px] text-muted-2">
            {done
              ? data.completedAt
                ? tr("checklist.completedAt", { time: new Date(data.completedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) })
                : tr("checklist.completed")
              : tr("checklist.hub.itemCount", { count: data.items.length })}
          </div>
        </div>
        <ChevronDown size={16} className={`text-muted-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <form action={formAction} className="px-4 pb-4 pt-1">
          <input type="hidden" name="checklistType" value={data.key} />
          <div className="flex flex-col gap-2.5 mb-4">
            {data.items.map((item, i) => (
              <label key={i} className="flex items-start gap-2.5 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="checked" value={i} defaultChecked={data.completedChecked[i] ?? false} className="mt-0.5 accent-brick w-4 h-4 shrink-0" />
                <span>{item}</span>
              </label>
            ))}
          </div>
          {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
          <div className="flex justify-end">
            <Btn type="submit" disabled={pending}>
              {pending ? tr("checklist.submitting") : done ? tr("checklist.update") : tr("checklist.submit")}
            </Btn>
          </div>
        </form>
      )}
    </div>
  );
}
