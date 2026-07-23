import { Eye, UserRound } from "lucide-react";
import { setDemoView } from "@/app/(app)/demo-view-actions";

// Demo-only bar that lets a sales rep flip between the owner view and the
// staff view mid-call, to show what a team member actually sees. Rendered only
// for demo orgs (see the app layout).
export function DemoViewToggle({ mode }: { mode: "owner" | "staff" }) {
  const staff = mode === "staff";
  return (
    <div className={`px-5 py-2 flex items-center justify-between gap-4 text-[13px] ${staff ? "bg-brick text-white" : "bg-ink text-white"}`}>
      <span className="flex items-center gap-2 min-w-0">
        <Eye size={15} className="shrink-0" />
        {staff ? (
          <span className="truncate">
            <span className="font-semibold">Staff view</span> — what a team member sees. Owner tools are hidden.
          </span>
        ) : (
          <span className="truncate">
            <span className="font-semibold">Demo</span> — owner view. Flip to see the staff experience.
          </span>
        )}
      </span>
      <form action={setDemoView.bind(null, staff ? "owner" : "staff")}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap rounded-full border border-white/30 px-3.5 py-1 hover:bg-white/10 transition-colors"
        >
          <UserRound size={14} /> {staff ? "Back to owner view" : "View as staff"}
        </button>
      </form>
    </div>
  );
}
