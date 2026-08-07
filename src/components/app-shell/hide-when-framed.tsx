"use client";

import { useIsFramed } from "@/lib/use-is-framed";

// Renders its children only when NOT inside an iframe. Used to keep the demo
// control bar out of the "phone view" preview (which frames the app itself).
export function HideWhenFramed({ children }: { children: React.ReactNode }) {
  const framed = useIsFramed();
  if (framed) return null;
  return <>{children}</>;
}
