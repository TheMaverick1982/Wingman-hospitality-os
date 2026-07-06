import { useEffect, useRef } from "react";

/** Closes a modal the moment a useActionState submission finishes without error. */
export function useCloseOnSuccess(pending: boolean, error: string | null, onClose: () => void) {
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !error) onClose();
    wasPending.current = pending;
  }, [pending, error, onClose]);
}
