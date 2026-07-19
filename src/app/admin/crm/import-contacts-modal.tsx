"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { importContacts } from "./actions";

type ParsedRow = { email: string; name: string | null; phone: string | null };

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else if (ch === '"') {
      inQ = true;
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];
  const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iEmail = idx("email", "email address", "e-mail");
  const iName = idx("name", "full name", "contact name");
  const iFirst = idx("first name", "first_name", "firstname");
  const iLast = idx("last name", "last_name", "lastname");
  const iPhone = idx("phone", "phone number", "mobile", "cell");

  const rows: ParsedRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseLine(line);
    const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const email = get(iEmail).toLowerCase();
    if (!email) continue;
    const name = get(iName) || [get(iFirst), get(iLast)].filter(Boolean).join(" ") || null;
    const phone = get(iPhone) || null;
    rows.push({ email, name: name || null, phone });
  }
  return rows;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function ImportContactsModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const valid = rows?.filter((r) => EMAIL_RE.test(r.email)) ?? [];

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result ?? ""));
        if (parsed.length === 0) setError("No rows with an email column were found. Make sure the file has an 'email' header.");
        setRows(parsed);
      } catch {
        setError("Couldn't read that file. Is it a .csv?");
      }
    };
    reader.readAsText(file);
  }

  function runImport() {
    if (!valid.length) return;
    setError(null);
    start(async () => {
      const res = await importContacts(valid);
      if (!res.ok) setError(res.error ?? "Import failed.");
      else {
        setResult({ imported: res.imported, updated: res.updated, skipped: res.skipped });
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[460px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="text-[17px] font-semibold text-ink">Import contacts</div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-2 hover:text-ink text-xl leading-none">×</button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          {result ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink">Import complete:</p>
              <ul className="text-[13.5px] text-charcoal-2 flex flex-col gap-1">
                <li>✅ <strong>{result.imported}</strong> new contacts added</li>
                <li>↻ <strong>{result.updated}</strong> existing contacts updated</li>
                <li>⏭ <strong>{result.skipped}</strong> skipped (duplicates or no change)</li>
              </ul>
              <button type="button" onClick={onClose} className="self-end text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-2 hover:bg-brick-dark transition-colors">Done</button>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-muted">
                Upload a <strong>.csv</strong> with an <code className="text-[12px] bg-paper px-1 py-0.5 rounded">email</code> column. Optional: <code className="text-[12px] bg-paper px-1 py-0.5 rounded">name</code> (or first/last), <code className="text-[12px] bg-paper px-1 py-0.5 rounded">phone</code>. Existing emails are updated, not duplicated.
              </p>

              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-7 cursor-pointer hover:border-brick/50 transition-colors">
                <UploadCloud size={22} className="text-muted-2" />
                <span className="text-[13px] font-semibold text-charcoal-2">{fileName || "Choose a CSV file"}</span>
                <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
              </label>

              {rows && (
                <div className="text-[13px] text-charcoal-2 bg-paper border border-line rounded-lg px-3 py-2">
                  Found <strong>{rows.length}</strong> rows · <strong>{valid.length}</strong> with a valid email.
                </div>
              )}
              {error && <p className="text-[12.5px] text-danger">{error}</p>}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="text-[13px] font-semibold text-charcoal-2 px-4 py-2 rounded-lg hover:bg-paper transition-colors">Cancel</button>
                <button type="button" onClick={runImport} disabled={pending || valid.length === 0} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-2 hover:bg-brick-dark disabled:opacity-40 transition-colors">
                  {pending ? "Importing…" : valid.length ? `Import ${valid.length}` : "Import"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
