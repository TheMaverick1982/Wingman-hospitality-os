// Post-shift feedback fields. Pure data so client + server share one source.
// A reflection is three short prompts; a submission needs at least one filled in.
export type ShiftFeedbackField = { id: "wentWell" | "improve" | "guestNotes"; label: string; placeholder: string };

export const SHIFT_FEEDBACK_FIELDS: ShiftFeedbackField[] = [
  { id: "wentWell", label: "What went well?", placeholder: "A win, a smooth section, a teammate who stepped up…" },
  { id: "improve", label: "What could be better?", placeholder: "A snag, something 86'd too early, a station that got slammed…" },
  { id: "guestNotes", label: "Anything guests said?", placeholder: "Compliments, complaints, a regular's birthday next week…" },
];
