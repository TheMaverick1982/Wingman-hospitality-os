import { Eye } from "lucide-react";
import { setDemoView } from "@/app/(app)/demo-view-actions";

// Demo-only bar that lets a sales rep flip between the owner view and a staff
// view — as a Server or a Chef — mid-call, to show what each role actually sees
// (a Chef, for instance, sees the recipes). Rendered only for demo orgs.
export function DemoViewToggle({ view }: { view: "owner" | "server" | "chef" }) {
  const chips: { role: "owner" | "server" | "chef"; label: string }[] = [
    { role: "owner", label: "Owner" },
    { role: "server", label: "Server" },
    { role: "chef", label: "Chef" },
  ];
  const isStaff = view !== "owner";
  return (
    <div className={`px-5 py-2 flex items-center justify-between gap-4 text-[13px] ${isStaff ? "bg-brick text-white" : "bg-ink text-white"}`}>
      <span className="flex items-center gap-2 min-w-0">
        <Eye size={15} className="shrink-0" />
        {view === "chef" ? (
          <span className="truncate"><span className="font-semibold">Chef view</span> — what a kitchen cook sees, including the recipes.</span>
        ) : view === "server" ? (
          <span className="truncate"><span className="font-semibold">Server view</span> — what a front-of-house team member sees.</span>
        ) : (
          <span className="truncate"><span className="font-semibold">Demo</span> — owner view. Flip to a staff role to show what they see.</span>
        )}
      </span>
      <div className="flex items-center gap-1 shrink-0 bg-white/10 rounded-full p-0.5">
        {chips.map((c) => (
          <form key={c.role} action={setDemoView.bind(null, c.role)}>
            <button
              type="submit"
              className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition-colors ${
                view === c.role ? "bg-white text-ink" : "text-white/90 hover:bg-white/10"
              }`}
            >
              {c.label}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
