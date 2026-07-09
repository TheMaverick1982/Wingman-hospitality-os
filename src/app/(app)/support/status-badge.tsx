const STYLES: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "text-[#B42318] bg-[#FDECEA]" },
  pending: { label: "Awaiting you", className: "text-[#B45309] bg-[#FDF3E1]" },
  closed: { label: "Closed", className: "text-[#15803d] bg-[#E7F6EC]" },
};

// `pending` means the support team replied and it's the customer's turn — from
// the customer's point of view that reads as "awaiting you". Admins get their
// own labels in the admin view.
export function StatusBadge({ status }: { status: "open" | "pending" | "closed" }) {
  const s = STYLES[status] ?? STYLES.open;
  return <span className={`shrink-0 text-[11.5px] font-semibold px-2.5 py-1 rounded-full ${s.className}`}>{s.label}</span>;
}
