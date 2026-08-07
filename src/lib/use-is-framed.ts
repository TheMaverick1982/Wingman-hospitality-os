"use client";

import { useEffect, useState } from "react";

// True when this page is rendered inside an iframe. Used to hide app chrome that
// shouldn't appear inside the demo "phone view" preview (the demo bar itself, the
// phone-view button — anything that would be meta or recursive in the preview).
// A cross-origin frame throws on window.top access, which also means "framed".
export function useIsFramed(): boolean {
  const [framed, setFramed] = useState(false);
  useEffect(() => {
    let inFrame = false;
    try {
      inFrame = window.self !== window.top;
    } catch {
      inFrame = true; // cross-origin top access throws → we're framed
    }
    // Framing can only be known on the client, after mount, from the DOM.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFramed(inFrame);
  }, []);
  return framed;
}
