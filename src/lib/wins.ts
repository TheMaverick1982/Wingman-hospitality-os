// Wins feed kinds. Pure data so client + server share one source.
// A "win" is something that went well (no target); a "shoutout" recognizes a
// specific teammate (the original culture-moment behavior).
export type WinKind = "win" | "shoutout";

export const WIN_KINDS: { id: WinKind; label: string }[] = [
  { id: "win", label: "Share a win" },
  { id: "shoutout", label: "Recognize a teammate" },
];

export const WIN_KIND_IDS = WIN_KINDS.map((k) => k.id);
