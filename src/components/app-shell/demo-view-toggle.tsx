import { Eye } from "lucide-react";
import { setDemoView } from "@/app/(app)/demo-view-actions";

// Demo-only bar that lets a sales rep flip between the owner view and a staff
// view — as a Server, a Chef, or a Bartender — mid-call, to show what each role
// actually sees (the Chef sees food recipes, the Bartender sees cocktail
// recipes). Rendered only for demo orgs.
export function DemoViewToggle({ view }: { view: "owner" | "server" | "chef" | "bartender" }) {
  const chips: { role: "owner" | "server" | "chef" | "bartender"; label: string }[] = [
    { role: "owner", label: "Owner" },
    { role: "server", label: "Server" },
    { role: "chef", label: "Chef" },
    { role: "bartender", label: "Bartender" },
  ];
  const isStaff = view !== "owner";
  return (
    <div className={`px-5 py-2 flex items-center justify-between gap-4 text-[13px] ${isStaff ? "bg-brick text-white" : "bg-ink text-white"}`}>
      <span className="flex items-center gap-2 min-w-0">
        <Eye size={15} className="shrink-0" />
        {view === "chef" ? (
          <span className="truncate"><span className="font-semibold">Chef view</span> — what a kitchen cook sees, including how to make each dish.</span>
        ) : view === "bartender" ? (
          <span className="truncate"><span className="font-semibold">Bartender view</span> — what a bartender sees, including the cocktail recipes.</span>
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
