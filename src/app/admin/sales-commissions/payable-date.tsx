"use client";

import { useRef } from "react";
import { setPayableDate } from "./actions";

// Inline "expected pay date" editor for an owed commission. Submits on change,
// so the owner just picks a date — no separate save button.
export function PayableDate({ id, value, due }: { id: string; value: string | null; due: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setPayableDate} className="inline-flex items-center gap-1.5 text-[12px]">
      <input type="hidden" name="id" value={id} />
      <span className={due ? "font-semibold text-olive" : "text-muted-2"}>{due ? "Due:" : "Expected pay:"}</span>
      <input
        type="date"
        name="payable_on"
        defaultValue={value ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className={`rounded-md border px-1.5 py-0.5 text-[12px] outline-none focus:border-brick ${due ? "border-olive/40 text-olive font-semibold" : "border-line text-charcoal-2"}`}
      />
    </form>
  );
}
