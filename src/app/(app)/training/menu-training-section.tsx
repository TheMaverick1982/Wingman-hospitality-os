"use client";

import { useActionState, useState, useTransition } from "react";
import { Upload, Trash2, Sparkles, Plus, ChevronRight, Pencil, X } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Pill } from "@/components/ui/pill";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import {
  uploadAndParseMenu,
  updateMenuItemMetrics,
  deleteMenuItem,
  deleteMenuItems,
  updateMenuItem,
  addCustomMenuItem,
  type MenuUploadState,
  type AddCustomDishState,
  type EditMenuItemState,
} from "./menu-items-actions";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number | null;
  allergens: string;
  pairing_suggestion: string;
  upsell_suggestion: string;
  source: "wingman" | "custom";
  popularity_pct: number | null;
  profit_amount: number | null;
};

const uploadInitial: MenuUploadState = { error: null };
const addInitial: AddCustomDishState = { error: null };

export function MenuTrainingSection({
  department,
  items,
  canEdit,
}: {
  department: string;
  items: MenuItem[];
  canEdit: boolean;
}) {
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadAndParseMenu, uploadInitial);
  const [showAdd, setShowAdd] = useState(false);
  const [addState, addAction, addPending] = useActionState(addCustomMenuItem, addInitial);
  useCloseOnSuccess(addPending, addState.error, () => setShowAdd(false));

  // Bulk-select for delete (owner view only).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clearSelected = () => setSelected(new Set());
  const deleteSelected = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} menu item${ids.length === 1 ? "" : "s"}? This can't be undone.`)) return;
    startBulk(async () => {
      await deleteMenuItems(ids);
      clearSelected();
    });
  };

  const engineered = items.filter((i) => i.popularity_pct != null && i.profit_amount != null);
  const avgPopularity = engineered.length
    ? engineered.reduce((s, i) => s + (i.popularity_pct ?? 0), 0) / engineered.length
    : 0;
  const avgProfit = engineered.length
    ? engineered.reduce((s, i) => s + (i.profit_amount ?? 0), 0) / engineered.length
    : 0;
  const quadrant = (i: MenuItem): "stars" | "puzzles" | "plowhorses" | "dogs" => {
    const highPop = (i.popularity_pct ?? 0) >= avgPopularity;
    const highProfit = (i.profit_amount ?? 0) >= avgProfit;
    if (highPop && highProfit) return "stars";
    if (!highPop && highProfit) return "puzzles";
    if (highPop && !highProfit) return "plowhorses";
    return "dogs";
  };
  const quadrants = {
    stars: engineered.filter((i) => quadrant(i) === "stars"),
    puzzles: engineered.filter((i) => quadrant(i) === "puzzles"),
    plowhorses: engineered.filter((i) => quadrant(i) === "plowhorses"),
    dogs: engineered.filter((i) => quadrant(i) === "dogs"),
  };

  return (
    <div className="mb-6">
      {canEdit && (
        <div className="bg-gold-tint rounded-2xl p-6 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Upload size={16} className="text-[#b45309]" />
            <h3 className="font-display text-lg font-semibold text-[#b45309]">Menu upload</h3>
          </div>
          <p className="text-xs mb-3 text-[#b45309]">
            Upload a photo or PDF of the {department.toLowerCase()} menu. Wingman reads it and builds
            category, pairing, allergen, and upsell training automatically. Re-uploading updates items
            that already exist (matched by name) instead of duplicating them, and keeps your
            popularity/profit numbers.
          </p>
          <form action={uploadAction} className="flex items-center gap-2">
            <input type="hidden" name="department" value={department} />
            <input
              type="file"
              name="file"
              accept="image/*,application/pdf"
              required
              className="text-sm text-[#b45309] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-panel file:text-ink file:text-sm file:font-semibold"
            />
            <Btn small type="submit" disabled={uploadPending} icon={Sparkles}>
              {uploadPending ? "Parsing..." : "Upload & parse"}
            </Btn>
          </form>
          {uploadState.error && <p className="text-sm text-danger mt-2">{uploadState.error}</p>}
          {uploadState.parsedCount != null && !uploadState.error && (
            <p className="text-sm text-[#15803d] mt-2">Parsed {uploadState.parsedCount} items.</p>
          )}
        </div>
      )}

      {canEdit && engineered.length >= 4 && (
        <div className="mb-5">
          <h3 className="font-display text-lg font-semibold text-ink mb-1">Menu engineering</h3>
          <p className="text-xs text-muted mb-3">
            Every dish mapped by popularity × profit. Feeds tonight&apos;s training and pre-shift.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <QuadrantCard title="Stars" tone="olive" sub="High popularity · high profit" note="Feature & protect" items={quadrants.stars} />
            <QuadrantCard title="Puzzles" tone="brick" sub="Low popularity · high profit" note="Sell harder" items={quadrants.puzzles} />
            <QuadrantCard title="Plowhorses" tone="gold" sub="High popularity · low profit" note="Re-engineer cost" items={quadrants.plowhorses} />
            <QuadrantCard title="Dogs" tone="danger" sub="Low popularity · low profit" note="Cut or rework" items={quadrants.dogs} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg font-semibold text-ink">Menu items</h3>
        {canEdit && (
          <Btn small kind="ghost" icon={Plus} onClick={() => setShowAdd((s) => !s)}>
            Add custom dish
          </Btn>
        )}
      </div>

      {canEdit && selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-brick-tint border border-brick/30 rounded-xl px-4 py-2.5 mb-3">
          <span className="text-[13px] font-semibold text-brick-dark">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={clearSelected} className="text-[13px] font-semibold text-muted-2 hover:text-ink">
              Clear
            </button>
            <button
              onClick={deleteSelected}
              disabled={bulkPending}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-danger rounded-full px-3.5 py-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Trash2 size={13} /> {bulkPending ? "Deleting…" : "Delete selected"}
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <form action={addAction} className="bg-panel border border-line rounded-2xl p-4 mb-3 grid grid-cols-2 gap-3">
          <input type="hidden" name="department" value={department} />
          <input name="name" placeholder="Dish name" required className={inputClass} />
          <input name="category" placeholder="Category (e.g. Mains, Cocktails)" className={inputClass} />
          <input name="allergens" placeholder="Allergens (comma separated)" className={`${inputClass} col-span-2`} />
          <input name="description" placeholder="Description" className={`${inputClass} col-span-2`} />
          <input name="pairing_suggestion" placeholder="Pairing suggestion" className={inputClass} />
          <input name="upsell_suggestion" placeholder="Upsell suggestion" className={inputClass} />
          {addState.error && <p className="text-sm text-danger col-span-2">{addState.error}</p>}
          <div className="col-span-2 flex justify-end">
            <Btn small type="submit" disabled={addPending}>
              {addPending ? "Adding..." : "Add dish"}
            </Btn>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted">No menu items yet — upload a menu to get started.</p>
      ) : (
        (() => {
          const groups = groupByCategory(items);
          // Not categorized yet (e.g. an older menu uploaded before categories) —
          // a flat list reads fine and re-uploading will group it.
          if (groups.length <= 1) {
            return (
              <div className="flex flex-col gap-2.5">
                {items.map((item) => (
                  <MenuItemRow key={item.id} item={item} canEdit={canEdit} selected={selected.has(item.id)} onToggle={() => toggleSelected(item.id)} />
                ))}
              </div>
            );
          }
          return (
            <div className="flex flex-col gap-2">
              {groups.map(([cat, catItems]) => (
                <details key={cat} className="group border border-line rounded-2xl bg-panel/40 overflow-hidden">
                  <summary className="flex items-center gap-2 cursor-pointer select-none list-none px-4 py-3 hover:bg-panel transition-colors">
                    <ChevronRight size={15} className="text-muted-2 shrink-0 transition-transform group-open:rotate-90" />
                    <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-charcoal-2">{cat}</span>
                    <span className="ml-1 text-xs text-muted-2 tabular-nums">{catItems.length}</span>
                    <span className="ml-auto text-[11px] font-medium text-muted-2 group-open:hidden">Tap to view</span>
                  </summary>
                  <div className="flex flex-col gap-2.5 px-3 pb-3 pt-1">
                    {catItems.map((item) => (
                      <MenuItemRow key={item.id} item={item} canEdit={canEdit} selected={selected.has(item.id)} onToggle={() => toggleSelected(item.id)} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}

// Canonical menu order so sections read top-to-bottom like a real menu. Anything
// the AI names that isn't in this list sorts after these (alphabetically), and
// uncategorized items group under "Other" at the very end.
const CATEGORY_ORDER = [
  "Appetizers", "Starters", "Small Plates", "Shareables", "Snacks",
  "Soups", "Salads", "Sandwiches", "Tacos", "Handhelds",
  "Pizza", "Pasta", "Entrées", "Entrees", "Mains", "Tasting Menu",
  "Sides", "Desserts",
  "Cocktails", "Wine", "Beer", "Non-Alcoholic", "Beverages", "Drinks",
];

function groupByCategory(items: MenuItem[]): [string, MenuItem[]][] {
  const groups = new Map<string, MenuItem[]>();
  for (const it of items) {
    const key = it.category?.trim() || "Other";
    const arr = groups.get(key) ?? [];
    arr.push(it);
    groups.set(key, arr);
  }
  const rank = (name: string) => {
    if (name === "Other") return 100000;
    const i = CATEGORY_ORDER.findIndex((c) => c.toLowerCase() === name.toLowerCase());
    return i === -1 ? 10000 : i;
  };
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
}

const TITLE_TONE_CLASSES = {
  olive: "text-olive",
  brick: "text-brick",
  gold: "text-gold",
  danger: "text-danger",
} as const;

function QuadrantCard({
  title,
  tone,
  sub,
  note,
  items,
}: {
  title: string;
  tone: "olive" | "brick" | "gold" | "danger";
  sub: string;
  note: string;
  items: MenuItem[];
}) {
  return (
    <div className="bg-panel border border-line rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className={`font-semibold text-sm ${TITLE_TONE_CLASSES[tone]}`}>{title}</span>
        <Pill tone={tone}>{note}</Pill>
      </div>
      <p className="text-xs text-muted mb-3">{sub}</p>
      <div className="flex flex-col gap-2">
        {items.length === 0 && <p className="text-xs text-muted">None yet.</p>}
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between text-sm">
            <span className="text-charcoal-2">{i.name}</span>
            <span className="font-mono text-xs text-muted">
              {i.popularity_pct}% · ${i.profit_amount} GP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const editInitial: EditMenuItemState = { error: null };

function MenuItemRow({ item, canEdit, selected, onToggle }: { item: MenuItem; canEdit: boolean; selected?: boolean; onToggle?: () => void }) {
  const [popularity, setPopularity] = useState(item.popularity_pct?.toString() ?? "");
  const [profit, setProfit] = useState(item.profit_amount?.toString() ?? "");
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editPending] = useActionState(updateMenuItem, editInitial);
  useCloseOnSuccess(editPending, editState.error, () => setEditing(false));

  function save() {
    updateMenuItemMetrics(item.id, popularity === "" ? null : Number(popularity), profit === "" ? null : Number(profit));
  }

  if (editing) {
    return (
      <form action={editAction} className="bg-panel border border-brick/40 rounded-2xl p-4 grid grid-cols-2 gap-3">
        <input type="hidden" name="id" value={item.id} />
        <input name="name" defaultValue={item.name} placeholder="Dish name" required className={inputClass} />
        <input name="category" defaultValue={item.category} placeholder="Category (e.g. Mains)" className={inputClass} />
        <input name="price" defaultValue={item.price ?? ""} type="number" step="0.01" placeholder="Price" className={inputClass} />
        <input name="allergens" defaultValue={item.allergens} placeholder="Allergens (comma separated)" className={inputClass} />
        <input name="description" defaultValue={item.description} placeholder="Description" className={`${inputClass} col-span-2`} />
        <input name="pairing_suggestion" defaultValue={item.pairing_suggestion} placeholder="Pairing suggestion" className={inputClass} />
        <input name="upsell_suggestion" defaultValue={item.upsell_suggestion} placeholder="Upsell suggestion" className={inputClass} />
        {editState.error && <p className="text-sm text-danger col-span-2">{editState.error}</p>}
        <div className="col-span-2 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-2 hover:text-ink">
            <X size={14} /> Cancel
          </button>
          <Btn small type="submit" disabled={editPending}>{editPending ? "Saving…" : "Save"}</Btn>
        </div>
      </form>
    );
  }

  return (
    <div className={`bg-panel border rounded-2xl p-4 ${selected ? "border-brick" : "border-line"}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {canEdit && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={onToggle}
              className="mt-0.5 w-4 h-4 accent-brick shrink-0 cursor-pointer"
              aria-label={`Select ${item.name}`}
            />
          )}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-sm font-semibold text-ink">{item.name}</span>
            {item.price != null && <span className="text-xs font-mono text-muted">${item.price}</span>}
            <Pill tone={item.source === "wingman" ? "brick" : "muted"}>{item.source === "wingman" ? "Wingman" : "Custom"}</Pill>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditing(true)} className="text-muted-2 hover:text-ink transition-colors" aria-label="Edit item">
              <Pencil size={14} />
            </button>
            <button onClick={() => deleteMenuItem(item.id)} className="text-muted-2 hover:text-danger transition-colors" aria-label="Delete item">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {item.description && <p className="text-xs text-muted mb-2">{item.description}</p>}
      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <div>
          <span className="font-semibold text-charcoal-2">Allergens: </span>
          <span className="text-muted">{item.allergens || "—"}</span>
        </div>
        <div>
          <span className="font-semibold text-charcoal-2">Pairing: </span>
          <span className="text-muted">{item.pairing_suggestion || "—"}</span>
        </div>
        <div className="col-span-2">
          <span className="font-semibold text-charcoal-2">Upsell: </span>
          <span className="text-muted">{item.upsell_suggestion || "—"}</span>
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-3 pt-2 border-t border-line">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Popularity
            <input
              type="number"
              min={0}
              max={100}
              value={popularity}
              onChange={(e) => setPopularity(e.target.value)}
              onBlur={save}
              placeholder="%"
              className="w-16 rounded-md border border-line-strong px-2 py-1 text-xs"
            />
            %
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Profit
            $
            <input
              type="number"
              step="0.01"
              value={profit}
              onChange={(e) => setProfit(e.target.value)}
              onBlur={save}
              placeholder="GP"
              className="w-16 rounded-md border border-line-strong px-2 py-1 text-xs"
            />
          </label>
          <span className="text-[11px] text-muted-2">Needed for the menu engineering matrix</span>
        </div>
      )}
    </div>
  );
}
