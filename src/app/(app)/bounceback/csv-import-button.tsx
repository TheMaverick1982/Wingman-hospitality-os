"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import type { Location } from "@/lib/data/locations";
import { importGuests, type ImportRow, type ImportResult } from "./actions";

const VISITS = [1, 2, 3, 4] as const;
type VisitPart = "date" | "bill" | "incentive" | "notes";
type FieldKey = "name" | "email" | "phone" | "source" | "location" | `v${number}_${VisitPart}`;

const BASE_FIELDS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: "name", label: "Guest name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "source", label: "Source (how they found you)" },
];
const VISIT_PARTS: { part: VisitPart; label: string }[] = [
  { part: "date", label: "Date" },
  { part: "bill", label: "Bill total ($)" },
  { part: "incentive", label: "Incentive / what was given" },
  { part: "notes", label: "Notes" },
];

const ALL_KEYS: FieldKey[] = [
  ...BASE_FIELDS.map((f) => f.key),
  "location",
  ...VISITS.flatMap((n) => VISIT_PARTS.map((p) => `v${n}_${p.part}` as FieldKey)),
];
const NO_MAP = () => Object.fromEntries(ALL_KEYS.map((k) => [k, -1])) as Record<FieldKey, number>;

// Accept common CSV date formats and normalize to YYYY-MM-DD; return "" if we
// can't read it confidently (that visit is simply skipped).
// Parse a bill total from a CSV cell, tolerating "$", commas, and blanks.
function parseBill(raw: string): number | null {
  const s = (raw || "").replace(/[$,\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normDate(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  const pad = (x: string) => x.padStart(2, "0");
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/); // M/D/Y (US)
  if (m) {
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${pad(m[1])}-${pad(m[2])}`;
  }
  return "";
}

// Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, CRLF).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function guessColumn(headers: string[], field: FieldKey): number {
  const h = headers.map((x) => x.toLowerCase().trim());
  const firstNonNeg = (...v: number[]) => v.find((x) => x >= 0) ?? -1;
  const findAny = (kw: string[]) => h.findIndex((x) => kw.some((k) => x.includes(k)));

  if (field === "name") return findAny(["guest name", "full name", "customer name", "name", "guest", "customer"]);
  if (field === "email") return findAny(["email", "e-mail"]);
  if (field === "phone") return findAny(["phone", "mobile", "cell", "tel"]);
  if (field === "source") return findAny(["source", "channel", "origin"]);
  if (field === "location") return findAny(["location", "store", "venue", "branch", "site", "restaurant"]);

  const vm = field.match(/^v(\d)_(date|bill|incentive|notes)$/);
  if (vm) {
    const n = Number(vm[1]);
    const re = new RegExp(`visit\\s*${n}\\b`);
    const withVisit = (extra: RegExp) => h.findIndex((x) => re.test(x) && extra.test(x));
    if (vm[2] === "date") {
      return firstNonNeg(
        withVisit(/date|visited|when/),
        h.findIndex((x) => x.replace(/\s+/g, "") === `visit${n}`) // a bare "Visit N" column = its date
      );
    }
    if (vm[2] === "bill") return withVisit(/bill|total|spend|spent|check|amount|revenue|sales/);
    if (vm[2] === "incentive") return withVisit(/incentive|offer|reward|given|comp|promo/);
    return withVisit(/note/);
  }
  return -1;
}

export function CsvImportButton({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>(NO_MAP());
  const [defaultLocationId, setDefaultLocationId] = useState(locations[0]?.id ?? "");
  // Per-CSV-value → system location overrides (for spelling mismatches etc.).
  const [locOverrides, setLocOverrides] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const multiLocation = locations.length > 1;
  const locIds = useMemo(() => new Set(locations.map((l) => l.id)), [locations]);
  const locByName = useMemo(() => new Map(locations.map((l) => [l.name.trim().toLowerCase(), l.id])), [locations]);

  // Best exact/case-insensitive auto-match for a raw CSV location value.
  const autoMatch = (v: string): string => {
    const t = (v || "").trim();
    if (!t) return "";
    if (locIds.has(t)) return t;
    return locByName.get(t.toLowerCase()) ?? "";
  };
  // The chosen system location id for a CSV value ("" = fall back to default).
  const effLoc = (v: string): string => (locOverrides[v] !== undefined ? locOverrides[v] : autoMatch(v));

  // The distinct location values present in the file (once a Location column is
  // mapped) — so the owner can match each to a system location.
  const distinctLocs = useMemo(() => {
    if (mapping.location < 0) return [];
    const set = new Set<string>();
    for (const r of rows) {
      const v = (r[mapping.location] ?? "").trim();
      if (v) set.add(v);
    }
    return [...set].slice(0, 100).sort((a, b) => a.localeCompare(b));
  }, [rows, mapping.location]);
  const unmatchedCount = distinctLocs.filter((v) => effLoc(v) === "").length;

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping(NO_MAP());
    setLocOverrides({});
    setError(null);
    setResult(null);
  };

  const onFile = async (file: File) => {
    setError(null);
    if (!/\.csv$/i.test(file.name) && !file.type.includes("csv")) return setError("Please choose a .csv file.");
    if (file.size > 5 * 1024 * 1024) return setError("File is too large — 5MB max.");
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) return setError("That CSV has no data rows.");
    const hdr = parsed[0];
    setHeaders(hdr);
    setRows(parsed.slice(1));
    setMapping(ALL_KEYS.reduce((acc, k) => ({ ...acc, [k]: guessColumn(hdr, k) }), NO_MAP()));
    setLocOverrides({});
    setStep("map");
  };

  const setKey = (key: FieldKey, val: number) => setMapping((m) => ({ ...m, [key]: val }));

  const runImport = () => {
    if (mapping.name < 0) return setError("Map the Guest name column — it's required.");
    setError(null);
    const cell = (r: string[], key: FieldKey) => (mapping[key] >= 0 ? (r[mapping[key]] ?? "") : "");
    const payload: ImportRow[] = rows.map((r) => ({
      name: cell(r, "name"),
      email: cell(r, "email"),
      phone: cell(r, "phone"),
      source: cell(r, "source"),
      locationId: mapping.location >= 0 ? (effLoc(cell(r, "location").trim()) || null) : null,
      visits: VISITS.map((n) => ({
        n,
        date: normDate(cell(r, `v${n}_date`)),
        incentive: cell(r, `v${n}_incentive`).trim(),
        notes: cell(r, `v${n}_notes`).trim(),
        bill: parseBill(cell(r, `v${n}_bill`)),
      })).filter((v) => v.date !== ""),
    }));
    start(async () => {
      const res = await importGuests(payload, multiLocation ? defaultLocationId : locations[0]?.id ?? null);
      setResult(res);
      if (!res.error) router.refresh();
    });
  };

  const rowFor = (key: FieldKey, label: string, required?: boolean) => (
    <MapRow label={label} required={required} value={mapping[key]} headers={headers} onChange={(n) => setKey(key, n)} />
  );

  return (
    <>
      <Btn kind="ghost" icon={Upload} onClick={() => { reset(); setOpen(true); }} className="shrink-0">
        Import CSV
      </Btn>
      {open && (
        <Modal title="Import guests from CSV" onClose={() => setOpen(false)} wide>
          {result ? (
            <div className="text-center py-4">
              {result.error ? (
                <p className="text-sm text-danger">{result.error}</p>
              ) : (
                <>
                  <CheckCircle2 size={40} className="text-olive mx-auto mb-3" />
                  <p className="text-[16px] font-semibold text-ink">Imported {result.imported} guest{result.imported === 1 ? "" : "s"}.</p>
                  {result.skipped > 0 && <p className="text-[13px] text-muted mt-1">{result.skipped} row{result.skipped === 1 ? "" : "s"} skipped (no name).</p>}
                </>
              )}
              <div className="flex justify-center gap-2 mt-5">
                <Btn kind="ghost" onClick={() => { reset(); }}>Import another</Btn>
                <Btn onClick={() => setOpen(false)}>Done</Btn>
              </div>
            </div>
          ) : step === "upload" ? (
            <div>
              <p className="text-sm text-muted mb-4">
                Upload a CSV of your guests (from your POS, reservations system, or a spreadsheet). You&rsquo;ll map the
                columns on the next step. The first row should be headers.
              </p>
              <label
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) onFile(file);
                }}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors ${
                  dragActive ? "border-brick bg-brick-tint" : "border-line hover:border-brick"
                }`}
              >
                <Upload size={22} className={dragActive ? "text-brick" : "text-muted-2"} />
                <span className="text-sm font-semibold text-ink">{dragActive ? "Drop to upload" : "Choose a CSV file"}</span>
                <span className="text-xs text-muted-2">or drag &amp; drop it here</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
              {error && <p className="text-sm text-danger mt-3">{error}</p>}
            </div>
          ) : (
            <div>
              <button onClick={() => setStep("upload")} className="flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink mb-4">
                <ArrowLeft size={14} /> Choose a different file
              </button>
              <p className="text-sm text-muted mb-1">
                Found <strong className="text-ink">{rows.length}</strong> row{rows.length === 1 ? "" : "s"}. Match your columns to Wingman&rsquo;s fields.
              </p>
              <p className="text-[12px] text-muted-2 mb-4">Dates can be YYYY-MM-DD or MM/DD/YYYY. A visit is recorded only when it has a date; anything we can&rsquo;t read is skipped.</p>

              <div className="flex flex-col gap-3 max-h-[52vh] overflow-y-auto pr-1">
                {BASE_FIELDS.map((f) => (
                  <div key={f.key}>{rowFor(f.key, f.label, f.required)}</div>
                ))}

                {multiLocation && (
                  <>
                    {rowFor("location", "Location column (name or ID)")}
                    <div className="grid grid-cols-2 items-center gap-3">
                      <label className="text-[13.5px] font-semibold text-charcoal-2">Default location <span className="text-muted-2 font-normal">(unmatched rows)</span></label>
                      <select value={defaultLocationId} onChange={(e) => setDefaultLocationId(e.target.value)} className={inputClass}>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>

                    {distinctLocs.length > 0 && (
                      <div className="rounded-xl border border-line bg-paper p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-2">
                            Match your file&rsquo;s locations ({distinctLocs.length})
                          </span>
                          {unmatchedCount > 0 && (
                            <span className="text-[11.5px] font-semibold text-[#B45309]">{unmatchedCount} need a match</span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted-2 mb-2.5">
                          We matched what we could. For anything spelled differently, pick the right location — or leave it on the default.
                        </p>
                        <div className="flex flex-col gap-2">
                          {distinctLocs.map((v) => {
                            const cur = effLoc(v);
                            return (
                              <div key={v} className="grid grid-cols-2 items-center gap-3">
                                <span className="text-[13px] text-ink truncate flex items-center gap-1.5" title={v}>
                                  {cur === "" && <span className="text-[#B45309]">●</span>}
                                  {v}
                                </span>
                                <select
                                  value={cur}
                                  onChange={(e) => setLocOverrides((m) => ({ ...m, [v]: e.target.value }))}
                                  className={`${inputClass} py-2 ${cur === "" ? "border-[#F0D9A8]" : ""}`}
                                >
                                  <option value="">Use default location</option>
                                  {locations.map((l) => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {VISITS.map((n) => (
                  <div key={n} className="border-t border-[#F1F1F1] pt-3 mt-1">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-2">Visit {n}</div>
                    <div className="flex flex-col gap-3">
                      {VISIT_PARTS.map((p) => (
                        <div key={p.part}>{rowFor(`v${n}_${p.part}` as FieldKey, p.label)}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-danger mt-3">{error}</p>}
              <div className="flex justify-end gap-2 mt-5">
                <Btn kind="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
                <Btn onClick={runImport} disabled={pending} icon={pending ? undefined : Upload}>
                  {pending ? <><Loader2 size={14} className="animate-spin" /> Importing…</> : `Import ${rows.length} guest${rows.length === 1 ? "" : "s"}`}
                </Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function MapRow({
  label,
  required,
  value,
  headers,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: number;
  headers: string[];
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 items-center gap-3">
      <label className="text-[13.5px] font-semibold text-charcoal-2">
        {label} {required && <span className="text-brick">*</span>}
      </label>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass}>
        <option value={-1}>— Not in my file —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
        ))}
      </select>
    </div>
  );
}
