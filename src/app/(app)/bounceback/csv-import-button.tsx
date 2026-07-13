"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import type { Location } from "@/lib/data/locations";
import { importGuests, type ImportRow, type ImportResult } from "./actions";

type FieldKey = "name" | "email" | "phone" | "source" | "firstVisitDate";
const FIELDS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: "name", label: "Guest name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "firstVisitDate", label: "First visit date (YYYY-MM-DD)" },
  { key: "source", label: "Source (how they found you)" },
];

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
  const has = (kw: string[]) => h.findIndex((x) => kw.some((k) => x.includes(k)));
  if (field === "name") return has(["full name", "name", "guest", "customer"]);
  if (field === "email") return has(["email", "e-mail"]);
  if (field === "phone") return has(["phone", "mobile", "cell", "tel"]);
  if (field === "firstVisitDate") return has(["visit date", "first visit", "date", "visited"]);
  if (field === "source") return has(["source", "channel", "origin"]);
  return -1;
}

export function CsvImportButton({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({ name: -1, email: -1, phone: -1, source: -1, firstVisitDate: -1 });
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const multiLocation = locations.length > 1;

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({ name: -1, email: -1, phone: -1, source: -1, firstVisitDate: -1 });
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
    setMapping({
      name: guessColumn(hdr, "name"),
      email: guessColumn(hdr, "email"),
      phone: guessColumn(hdr, "phone"),
      source: guessColumn(hdr, "source"),
      firstVisitDate: guessColumn(hdr, "firstVisitDate"),
    });
    setStep("map");
  };

  const runImport = () => {
    if (mapping.name < 0) return setError("Map the Guest name column — it's required.");
    setError(null);
    const payload: ImportRow[] = rows.map((r) => ({
      name: mapping.name >= 0 ? (r[mapping.name] ?? "") : "",
      email: mapping.email >= 0 ? (r[mapping.email] ?? "") : "",
      phone: mapping.phone >= 0 ? (r[mapping.phone] ?? "") : "",
      source: mapping.source >= 0 ? (r[mapping.source] ?? "") : "",
      firstVisitDate: mapping.firstVisitDate >= 0 ? (r[mapping.firstVisitDate] ?? "") : "",
    }));
    start(async () => {
      const res = await importGuests(payload, multiLocation ? locationId : locations[0]?.id ?? null);
      setResult(res);
      if (!res.error) router.refresh();
    });
  };

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
              <p className="text-sm text-muted mb-4">
                Found <strong className="text-ink">{rows.length}</strong> row{rows.length === 1 ? "" : "s"}. Match your columns to Wingman&rsquo;s fields:
              </p>
              <div className="flex flex-col gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key} className="grid grid-cols-2 items-center gap-3">
                    <label className="text-[13.5px] font-semibold text-charcoal-2">
                      {f.label} {f.required && <span className="text-brick">*</span>}
                    </label>
                    <select
                      value={mapping[f.key]}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                      className={inputClass}
                    >
                      <option value={-1}>— Not in my file —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {multiLocation && (
                  <div className="grid grid-cols-2 items-center gap-3">
                    <label className="text-[13.5px] font-semibold text-charcoal-2">Location for first visits</label>
                    <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputClass}>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                )}
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
