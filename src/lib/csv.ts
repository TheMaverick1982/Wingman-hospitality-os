function csvEscape(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Neutralize formula injection: spreadsheet apps treat cells starting with
  // these characters as formulas when the CSV is opened.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  return lines.join("\n");
}

// A small, dependency-free CSV parser good enough for spreadsheet exports:
// handles quoted fields, embedded commas/newlines, and "" escaped quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const stripped = text.replace(/^﻿/, ""); // drop BOM

  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (inQuotes) {
      if (c === '"') {
        if (stripped[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c === "\r") {
      // ignore — handled by the \n case
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // Drop fully-empty rows (trailing newline, blank lines).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = toCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
