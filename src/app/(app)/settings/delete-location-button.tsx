"use client";

import { useTransition } from "react";
import { deleteLocation } from "./actions";

export function DeleteLocationButton({ locationId, locationName }: { locationId: string; locationName: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `Remove "${locationName}"?\n\nThis permanently deletes this location and all of its data — checklists, spot-checks, staff roster, coaching, and growth entries — and stops billing for it. This can't be undone.`
          )
        )
          return;
        start(async () => {
          const res = await deleteLocation(locationId);
          if (res.error) window.alert(res.error);
        });
      }}
      className="text-[13px] font-semibold text-brick hover:opacity-70 disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
