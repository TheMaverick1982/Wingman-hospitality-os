"use client";

import { Download } from "lucide-react";
import { Btn } from "./btn";
import { downloadCsv } from "@/lib/csv";

export function ExportCsvButton({
  filename,
  headers,
  rows,
  label = "Export",
}: {
  filename: string;
  headers: string[];
  rows: unknown[][];
  label?: string;
}) {
  return (
    <Btn small kind="ghost" icon={Download} onClick={() => downloadCsv(filename, headers, rows)}>
      {label}
    </Btn>
  );
}
