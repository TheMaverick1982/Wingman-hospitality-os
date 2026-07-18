"use client";

import dynamic from "next/dynamic";
import type { CalendarClientProps } from "./calendar-client";

// Render the calendar admin UI client-only. It's an interactive tool that doesn't
// need SSR, and this keeps any render error on the client where the real message
// is preserved (server-render errors are stripped in production), so the error
// monitor reports something actionable instead of a blank digest.
const CalendarClient = dynamic(() => import("./calendar-client").then((m) => ({ default: m.CalendarClient })), {
  ssr: false,
  loading: () => <div className="text-sm text-muted py-10">Loading your calendar…</div>,
});

export function CalendarMount(props: CalendarClientProps) {
  return <CalendarClient {...props} />;
}
