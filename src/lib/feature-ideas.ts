// Pure types + constants for the Feature Ideas board — safe to import from both
// server and client. The data fetch lives in feature-ideas-data.ts (server-only).

export type IdeaStatus = "open" | "planned" | "in_progress" | "shipped" | "declined";
export type IdeaSort = "newest" | "most" | "least";

export type Idea = {
  id: string;
  title: string;
  details: string;
  status: IdeaStatus;
  created_at: string;
  votes: number;
  voted: boolean; // did the current user vote for it
};

export const IDEA_STATUS_META: Record<IdeaStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-paper text-muted border border-line" },
  planned: { label: "Planned", className: "bg-gold-tint text-[#B45309]" },
  in_progress: { label: "In progress", className: "bg-brick-tint text-brick-dark" },
  shipped: { label: "Shipped", className: "bg-olive-tint text-[#3f6212]" },
  declined: { label: "Not planned", className: "bg-[#F1F1F1] text-muted-2" },
};

export const IDEA_SORTS: { key: IdeaSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "most", label: "Most votes" },
  { key: "least", label: "Least votes" },
];
