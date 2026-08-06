// Shift board note kinds. Pure data so client + server both use it.
export type ShiftNoteKind = "eightysix" | "staffing" | "note";

export const SHIFT_KINDS: { id: ShiftNoteKind; label: string; hint: string }[] = [
  { id: "eightysix", label: "86'd", hint: "Out of stock — e.g. \"86 the salmon\"" },
  // Framed as scheduling, never the reason someone's gone (HR-safe).
  { id: "staffing", label: "Staffing", hint: "Who's off the schedule / covering — not the reason" },
  { id: "note", label: "Note", hint: "Anything the shift should know" },
];

export const KIND_LABEL: Record<string, string> = Object.fromEntries(SHIFT_KINDS.map((k) => [k.id, k.label]));
export const KIND_IDS = SHIFT_KINDS.map((k) => k.id);
