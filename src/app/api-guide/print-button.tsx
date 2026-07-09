"use client";

import { Download } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-lg bg-brick text-white text-sm font-semibold px-4 py-2 hover:opacity-90"
    >
      <Download size={15} /> Save as PDF
    </button>
  );
}
