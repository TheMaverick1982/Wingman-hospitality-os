import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = {
  id: string;
  subject: string;
  status: "open" | "pending" | "closed";
  last_activity_at: string;
  organizations: { name: string } | null;
  profiles: { full_name: string } | null;
};

const TABS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "pending", label: "Awaiting customer" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

const STATUS_STYLE: Record<string, string> = {
  open: "text-[#B42318] bg-[#FDECEA]",
  pending: "text-[#B45309] bg-[#FDF3E1]",
  closed: "text-[#15803d] bg-[#E7F6EC]",
};

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const active = TABS.some((t) => t.key === status) ? status! : "open";

  const admin = createAdminClient();
  let query = admin
    .from("support_tickets")
    .select("id, subject, status, last_activity_at, organizations(name), profiles(full_name)")
    .order("last_activity_at", { ascending: false })
    .limit(200);
  if (active !== "all") query = query.eq("status", active);
  const { data } = await query;
  const tickets = (data ?? []) as unknown as Row[];

  return (
    <>
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Support</h1>
        <p className="text-base text-muted">Tickets from every organization.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/support?status=${t.key}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
              active === t.key ? "bg-charcoal text-white border-charcoal" : "bg-white text-ink border-line"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tickets.length > 0 ? (
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/admin/support/${t.id}`}
              className="flex items-center gap-4 px-5 py-4 border-b border-[#F5F5F5] last:border-0 hover:bg-paper transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-ink truncate">{t.subject}</div>
                <div className="text-[13px] text-muted-2">
                  <span className="font-semibold text-charcoal-2">{t.organizations?.name ?? "Unknown org"}</span>
                  {t.profiles?.full_name ? ` · ${t.profiles.full_name}` : ""} ·{" "}
                  {new Date(t.last_activity_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              <span className={`shrink-0 text-[11.5px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[t.status]}`}>
                {t.status === "pending" ? "Awaiting customer" : t.status[0].toUpperCase() + t.status.slice(1)}
              </span>
              <ChevronRight size={17} className="text-muted-2 shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl px-6 py-10 text-center shadow-sm">
          <p className="text-sm text-muted">No {active === "all" ? "" : active} tickets.</p>
        </div>
      )}
    </>
  );
}
