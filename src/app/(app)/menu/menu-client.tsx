"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { Plus, UtensilsCrossed, Upload, Pencil } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { StatTile } from "@/components/ui/stat-tile";
import { DeleteIconButton } from "@/components/ui/delete-icon-button";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { parseCsv } from "@/lib/csv";
import {
  classifyMenu,
  QUADRANT_META,
  MENU_DESIGN_TIPS,
  POPULARITY_OPTIONS,
  type MenuItemRow,
} from "@/lib/menu-engineering";
import { addMenuItem, updateMenuItem, importMenuItems, deleteMenuItem, type ActionState } from "./actions";

const initialState: ActionState = { error: null };
const money = (n: number) => `$${n.toFixed(2)}`;

// The four fields a CSV column can map to. "name" is the only required one.
const FIELDS = [
  { key: "name", label: "Item name", required: true, hints: ["name", "item", "dish", "product", "menu item"] },
  { key: "price", label: "Menu price", required: false, hints: ["price", "menu price", "retail"] },
  { key: "foodCost", label: "Food cost", required: false, hints: ["food cost", "cost", "cogs", "plate cost"] },
  { key: "popularity", label: "How well it sells", required: false, hints: ["popularity", "sells", "sold", "sales", "volume", "class"] },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
const BLANK = -1; // "leave blank" sentinel for a column mapping

function toNumber(s: string): number | null {
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Accept 1–3, or words like High/Med/Low (and a few synonyms). Blank/unknown
// leaves it unset so the server defaults it to Medium.
function toPopularity(s: string): number | null {
  const t = String(s).trim().toLowerCase();
  if (!t) return null;
  const n = parseInt(t, 10);
  if (n >= 1 && n <= 3) return n;
  if (/^(h|top|star|best)/.test(t)) return 3;
  if (/^(m|med|steady|avg|average)/.test(t)) return 2;
  if (/^(l|low|slow|rare|dog)/.test(t)) return 1;
  return null;
}

function guessColumn(headers: string[], hints: readonly string[]): number {
  const norm = headers.map((h) => h.trim().toLowerCase());
  // Prefer an exact header match, then a contains-match.
  for (const hint of hints) {
    const exact = norm.indexOf(hint);
    if (exact !== -1) return exact;
  }
  for (let i = 0; i < norm.length; i++) {
    if (hints.some((hint) => norm[i].includes(hint))) return i;
  }
  return BLANK;
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (n: number) => void }) {
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({ name: BLANK, price: BLANK, foodCost: BLANK, popularity: BLANK });
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      if (rows.length < 2) {
        setErr("That file needs a header row and at least one item.");
        setHeaders(null); setDataRows([]);
        return;
      }
      const hdr = rows[0].map((h) => h.trim());
      setHeaders(hdr);
      setDataRows(rows.slice(1));
      setMapping({
        name: guessColumn(hdr, FIELDS[0].hints),
        price: guessColumn(hdr, FIELDS[1].hints),
        foodCost: guessColumn(hdr, FIELDS[2].hints),
        popularity: guessColumn(hdr, FIELDS[3].hints),
      });
    };
    reader.onerror = () => setErr("Couldn't read that file. Try re-saving it as CSV.");
    reader.readAsText(file);
  }

  const previewRows = useMemo(() => {
    if (mapping.name === BLANK) return [];
    return dataRows
      .map((r) => ({
        name: (r[mapping.name] ?? "").trim(),
        price: mapping.price === BLANK ? null : toNumber(r[mapping.price] ?? ""),
        foodCost: mapping.foodCost === BLANK ? null : toNumber(r[mapping.foodCost] ?? ""),
        popularity: mapping.popularity === BLANK ? null : toPopularity(r[mapping.popularity] ?? ""),
      }))
      .filter((r) => r.name);
  }, [dataRows, mapping]);

  function doImport() {
    setErr(null);
    if (mapping.name === BLANK) { setErr("Map which column holds the item name — that one's required."); return; }
    if (previewRows.length === 0) { setErr("No rows with an item name to import."); return; }
    start(async () => {
      const res = await importMenuItems(previewRows);
      if (res.error) setErr(res.error);
      else onImported(res.imported);
    });
  }

  return (
    <Modal
      title="Import menu items from CSV"
      sub="Upload a spreadsheet, map your columns, and import. Leave any field blank to fill it in later."
      onClose={onClose}
      wide
    >
      {!headers ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-2xl py-10 px-6 text-center hover:border-brick hover:bg-brick-tint/30 transition-colors"
          >
            <Upload size={26} className="text-muted-2" />
            <span className="text-[15px] font-semibold text-ink">Choose a CSV file</span>
            <span className="text-[13px] text-muted">One row per item, with a header row. Columns can be in any order.</span>
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          <div className="text-[12.5px] text-muted-2">
            Tip: an easy layout is <span className="font-mono text-charcoal-2">Name, Price, Food cost, Popularity</span> — but you&rsquo;ll map
            columns on the next step, so any headers work. Popularity accepts High/Med/Low or 1–3.
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="text-[13px] text-muted">
            Loaded <span className="font-semibold text-ink">{fileName}</span> — {dataRows.length} row{dataRows.length === 1 ? "" : "s"}. Match your columns:
          </div>

          <div className="flex flex-col gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
                <div className="text-[14px] font-medium text-ink">
                  {f.label}
                  {f.required ? <span className="text-danger"> *</span> : <span className="text-muted-2 text-[12.5px]"> (optional)</span>}
                </div>
                <select
                  value={mapping[f.key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                  className={inputClass}
                >
                  <option value={BLANK}>{f.required ? "— choose a column —" : "— leave blank —"}</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {previewRows.length > 0 && (
            <div className="border border-line rounded-xl overflow-hidden">
              <div className="bg-[#FAFAFA] px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted border-b border-line">
                Preview · {previewRows.length} item{previewRows.length === 1 ? "" : "s"} will import
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                <table className="w-full text-[13px] min-w-[640px]">
                  <thead>
                    <tr className="text-left text-muted-2">
                      <th className="px-4 py-1.5 font-medium">Name</th>
                      <th className="px-4 py-1.5 font-medium">Price</th>
                      <th className="px-4 py-1.5 font-medium">Food cost</th>
                      <th className="px-4 py-1.5 font-medium">Sells</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-line/70">
                        <td className="px-4 py-1.5 text-ink">{r.name}</td>
                        <td className="px-4 py-1.5 text-muted tabular-nums">{r.price == null ? <span className="text-muted-2">—</span> : money(r.price)}</td>
                        <td className="px-4 py-1.5 text-muted tabular-nums">{r.foodCost == null ? <span className="text-muted-2">—</span> : money(r.foodCost)}</td>
                        <td className="px-4 py-1.5 text-muted">{r.popularity == null ? <span className="text-muted-2">—</span> : r.popularity === 3 ? "High" : r.popularity === 2 ? "Med" : "Low"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 text-[12px] text-muted-2 border-t border-line">Dashes fill in with sensible defaults (0 price/cost, medium sells) — edit any item later to finish it.</div>
            </div>
          )}

          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex justify-between gap-2">
            <Btn type="button" kind="ghost" onClick={() => { setHeaders(null); setDataRows([]); setFileName(""); setErr(null); }}>
              Choose a different file
            </Btn>
            <div className="flex gap-2">
              <Btn type="button" kind="ghost" onClick={onClose}>Cancel</Btn>
              <Btn type="button" onClick={doImport} disabled={pending || previewRows.length === 0}>
                {pending ? "Importing…" : `Import ${previewRows.length || ""} item${previewRows.length === 1 ? "" : "s"}`}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditModal({ item, onClose }: { item: MenuItemRow; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price ?? ""));
  const [foodCost, setFoodCost] = useState(String(item.food_cost ?? ""));
  const [popularity, setPopularity] = useState(item.popularity ?? 2);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const res = await updateMenuItem(item.id, {
        name,
        price: price.trim() === "" ? 0 : Number(price),
        foodCost: foodCost.trim() === "" ? 0 : Number(foodCost),
        popularity,
      });
      if (res.error) setErr(res.error);
      else onClose();
    });
  }

  return (
    <Modal title="Edit menu item" sub="Fill in anything you left blank, or fix a number." onClose={onClose}>
      <Field label="Item name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Menu price ($)">
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="16.95" className={inputClass} />
        </Field>
        <Field label="Food cost ($)">
          <input type="number" min="0" step="0.01" value={foodCost} onChange={(e) => setFoodCost(e.target.value)} placeholder="4.20" className={inputClass} />
        </Field>
      </div>
      <Field label="How well does it sell?">
        <select value={popularity} onChange={(e) => setPopularity(Number(e.target.value))} className={inputClass}>
          {POPULARITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
      {err && <p className="text-sm text-danger mb-2">{err}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn type="button" kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Btn>
      </div>
    </Modal>
  );
}

export function MenuClient({ items, canEdit }: { items: MenuItemRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editItem, setEditItem] = useState<MenuItemRow | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(addMenuItem, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  const { items: classified, counts } = useMemo(() => classifyMenu(items), [items]);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Menu Engineering</h1>
          <p className="text-base text-muted max-w-2xl">
            Your menu is your most-used sales tool. Add your key movers with their price, food cost, and how well they
            sell — we&apos;ll sort them into what to <span className="font-semibold text-ink">feature, fix, or cut</span>.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
            <Btn icon={Upload} kind="ghost" onClick={() => setImporting(true)}>
              Import CSV
            </Btn>
            <Btn icon={Plus} onClick={() => setOpen(true)}>
              Add item
            </Btn>
          </div>
        )}
      </div>

      {flash && (
        <div className="bg-olive/10 border border-olive/30 text-olive-dark rounded-xl px-4 py-2.5 text-[14px] font-medium">
          {flash}
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-paper border border-line rounded-2xl p-10 text-center">
          <UtensilsCrossed size={28} className="mx-auto text-muted-2 mb-3" />
          <p className="text-sm text-muted max-w-md mx-auto">
            {canEdit
              ? "Start with your top 8–10 movers — the dishes that make or lose you the most money. You don't need the whole menu to see the pattern. Add them one at a time, or import a CSV."
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

          <div className="bg-white border border-line rounded-2xl overflow-x-auto shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
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
                        <td className="px-5 py-3.5">
                          {canEdit && (
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => setEditItem(item)}
                                title="Edit item"
                                className="text-muted-2 hover:text-brick p-1.5 rounded-lg hover:bg-brick-tint transition-colors"
                              >
                                <Pencil size={15} />
                              </button>
                              <DeleteIconButton id={item.id} action={deleteMenuItem} />
                            </div>
                          )}
                        </td>
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

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={(n) => {
            setImporting(false);
            setFlash(`Imported ${n} item${n === 1 ? "" : "s"}. Edit any with blank fields to finish them.`);
          }}
        />
      )}

      {editItem && <EditModal item={editItem} onClose={() => setEditItem(null)} />}

      {!canEdit && items.length > 0 && (
        <div className="flex justify-end">
          <Pill>View only</Pill>
        </div>
      )}
    </>
  );
}
