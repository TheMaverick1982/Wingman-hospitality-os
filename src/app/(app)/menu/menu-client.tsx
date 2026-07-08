"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, UtensilsCrossed } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { StatTile } from "@/components/ui/stat-tile";
import { DeleteIconButton } from "@/components/ui/delete-icon-button";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import {
  classifyMenu,
  QUADRANT_META,
  MENU_DESIGN_TIPS,
  POPULARITY_OPTIONS,
  type MenuItemRow,
} from "@/lib/menu-engineering";
import { addMenuItem, deleteMenuItem, type ActionState } from "./actions";

const initialState: ActionState = { error: null };
const money = (n: number) => `$${n.toFixed(2)}`;

export function MenuClient({ items, canEdit }: { items: MenuItemRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addMenuItem, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  const { items: classified, counts } = useMemo(() => classifyMenu(items), [items]);

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Menu Engineering</h1>
          <p className="text-base text-muted max-w-2xl">
            Your menu is your most-used sales tool. Add your key movers with their price, food cost, and how well they
            sell — we&apos;ll sort them into what to <span className="font-semibold text-ink">feature, fix, or cut</span>.
          </p>
        </div>
        {canEdit && (
          <Btn icon={Plus} onClick={() => setOpen(true)} className="shrink-0">
            Add item
          </Btn>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-paper border border-line rounded-2xl p-10 text-center">
          <UtensilsCrossed size={28} className="mx-auto text-muted-2 mb-3" />
          <p className="text-sm text-muted max-w-md mx-auto">
            {canEdit
              ? "Start with your top 8–10 movers — the dishes that make or lose you the most money. You don't need the whole menu to see the pattern."
              : "No menu items have been added yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <StatTile label="Stars" value={counts.star} sub="high profit, high sales" />
            <StatTile label="Puzzles" value={counts.puzzle} sub="high profit, low sales" />
            <StatTile label="Plowhorses" value={counts.plowhorse} sub="low profit, high sales" />
            <StatTile label="Dogs" value={counts.dog} sub="low profit, low sales" />
          </div>

          <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-line">
                    {["Item", "Price", "Food cost", "$ Margin", "Margin %", "Sells", "Type", "Do this", ""].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classified.map((item) => {
                    const meta = QUADRANT_META[item.quadrant];
                    const popLabel = item.popularity === 3 ? "High" : item.popularity === 2 ? "Med" : "Low";
                    return (
                      <tr key={item.id} className="border-b border-line last:border-b-0 hover:bg-[#FAFAFA] transition-colors align-top">
                        <td className="px-5 py-3.5 text-ink font-medium">{item.name}</td>
                        <td className="px-5 py-3.5 text-muted tabular-nums">{money(item.price)}</td>
                        <td className="px-5 py-3.5 text-muted tabular-nums">{money(item.food_cost)}</td>
                        <td className="px-5 py-3.5 text-ink font-semibold tabular-nums">{money(item.margin)}</td>
                        <td className="px-5 py-3.5 text-muted tabular-nums">{Math.round(item.marginPct * 100)}%</td>
                        <td className="px-5 py-3.5 text-muted">{popLabel}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.tone}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted text-[13px] max-w-[280px]">{meta.action}</td>
                        <td className="px-5 py-3.5">{canEdit && <DeleteIconButton id={item.id} action={deleteMenuItem} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
            <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Menu design levers</div>
            <div className="text-[13px] text-muted mb-5">Small layout changes that lift profit without changing a single recipe.</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {MENU_DESIGN_TIPS.map((tip) => (
                <div key={tip.title} className="flex gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brick shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-ink">{tip.title}</div>
                    <div className="text-[13px] text-muted leading-relaxed">{tip.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {open && (
        <Modal title="Add a menu item" sub="Just the price, what it costs you to make, and how well it sells." onClose={() => setOpen(false)}>
          <form action={formAction}>
            <Field label="Item name">
              <input name="name" required placeholder="e.g. Detroit Bianco Pizza" className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Menu price ($)">
                <input type="number" name="price" min="0" step="0.01" required placeholder="16.95" className={inputClass} />
              </Field>
              <Field label="Food cost ($)">
                <input type="number" name="foodCost" min="0" step="0.01" required placeholder="4.20" className={inputClass} />
              </Field>
            </div>
            <Field label="How well does it sell?">
              <select name="popularity" defaultValue={2} className={inputClass}>
                {POPULARITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Adding..." : "Add item"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {!canEdit && items.length > 0 && (
        <div className="flex justify-end">
          <Pill>View only</Pill>
        </div>
      )}
    </>
  );
}
