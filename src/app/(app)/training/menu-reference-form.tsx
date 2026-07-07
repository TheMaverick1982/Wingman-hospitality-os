"use client";

import { useActionState, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { updateMenuReference, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function MenuReferenceForm({
  department,
  initialContent,
  isGm,
}: {
  department: string;
  initialContent: string;
  isGm: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateMenuReference, initialState);
  const [value, setValue] = useState(initialContent);

  return (
    <div className="bg-gold-tint rounded-2xl p-6 mb-5">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList size={16} className="text-[#b45309]" />
        <h3 className="font-display text-lg font-semibold text-[#b45309]">Menu reference</h3>
      </div>
      <p className="text-xs mb-3 text-[#b45309]">
        Staff study this alongside the checklist below.
      </p>
      {isGm ? (
        <form action={formAction}>
          <input type="hidden" name="department" value={department} />
          <textarea
            name="content"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            placeholder="e.g. Detroit Bianco — mozzarella, ricotta, garlic oil, basil. Contains dairy, gluten..."
            className="w-full rounded-lg p-3 text-sm bg-panel border border-[#ffcc80] text-ink mb-2"
          />
          <div className="flex justify-end">
            <Btn small type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Btn>
          </div>
          {state.error && <p className="text-sm text-brick mt-1">{state.error}</p>}
        </form>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-[#b45309]">{initialContent || "Nothing added yet."}</p>
      )}
    </div>
  );
}
