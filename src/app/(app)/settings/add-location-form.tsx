"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { addLocation, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function AddLocationForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addLocation, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  if (!open) {
    return (
      <Btn small kind="ghost" icon={Plus} onClick={() => setOpen(true)}>
        Add location
      </Btn>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input name="name" placeholder="Location name" required autoFocus className={`${inputClass} w-48`} />
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <Btn small type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add"}
      </Btn>
      <Btn small type="button" kind="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Btn>
    </form>
  );
}
