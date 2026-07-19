"use client";

import { useState } from "react";
import { LayoutGrid, Table2, Plus, UploadCloud } from "lucide-react";
import { CRM_STAGES } from "@/lib/crm";
import { PipelineBoard } from "./pipeline-board";
import { ContactsTable, type ContactRow } from "./contacts-table";
import { AddContactModal } from "./add-contact-modal";
import { ImportContactsModal } from "./import-contacts-modal";

// Wraps the CRM contact list with a Board (pipeline) / Table (GHL-style list)
// toggle. Both views share the same loaded contacts.
export function CrmWorkspace({ contacts }: { contacts: ContactRow[] }) {
  const [view, setView] = useState<"table" | "board">("table");
  const [modal, setModal] = useState<"add" | "import" | null>(null);

  const tab = (key: "table" | "board", label: string, Icon: typeof LayoutGrid) => (
    <button
      type="button"
      onClick={() => setView(key)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
        view === key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      <Icon size={15} strokeWidth={2} />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-paper border border-line rounded-xl p-1 w-fit">
          {tab("table", "Table", Table2)}
          {tab("board", "Board", LayoutGrid)}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setModal("import")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 bg-white border border-line-strong rounded-lg px-3 py-2 hover:bg-paper transition-colors">
            <UploadCloud size={15} strokeWidth={2} /> Import
          </button>
          <button type="button" onClick={() => setModal("add")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-lg px-3 py-2 hover:bg-brick-dark transition-colors">
            <Plus size={15} strokeWidth={2.5} /> Add contact
          </button>
        </div>
      </div>
      {view === "table" ? <ContactsTable contacts={contacts} /> : <PipelineBoard contacts={contacts} stages={CRM_STAGES} />}

      {modal === "add" && <AddContactModal onClose={() => setModal(null)} />}
      {modal === "import" && <ImportContactsModal onClose={() => setModal(null)} />}
    </div>
  );
}
