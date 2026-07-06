"use client";

import { Trash2 } from "lucide-react";

export function DeleteIconButton({ id, action }: { id: string; action: (id: string) => Promise<void> }) {
  return (
    <button onClick={() => action(id)} className="text-brick" type="button">
      <Trash2 size={15} />
    </button>
  );
}
