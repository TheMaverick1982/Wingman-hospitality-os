import Link from "next/link";
import { LifeBuoy, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { NewTicketButton } from "./new-ticket-form";
import { StatusBadge } from "./status-badge";

// The support page triggers an email (via createTicket); give it headroom.
export const maxDuration = 60;

type Row = {
  id: string;
  subject: string;
  status: "open" | "pending" | "closed";
  last_activity_at: string;
  profiles: { full_name: string } | null;
};

export default async function SupportPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id, subject, status, last_activity_at, profiles(full_name)")
    .order("last_activity_at", { ascending: false });
  const tickets = (data ?? []) as unknown as Row[];

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Support</h1>
          <p className="text-base text-muted">Have a question or hit a snag? Open a ticket and our team will help.</p>
        </div>
        <NewTicketButton />
      </div>

      {tickets.length > 0 ? (
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.id}`}
              className="flex items-center gap-4 px-5 py-4 border-b border-[#F5F5F5] last:border-0 hover:bg-paper transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-ink truncate">{t.subject}</div>
                <div className="text-[13px] text-muted-2">
                  {t.profiles?.full_name ? `${t.profiles.full_name} · ` : ""}
                  {new Date(t.last_activity_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              <StatusBadge status={t.status} />
              <ChevronRight size={17} className="text-muted-2 shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl px-6 py-10 text-center shadow-sm">
          <LifeBuoy size={28} className="text-muted-2 mx-auto mb-3" />
          <p className="text-sm text-muted mb-4">No tickets yet. Open one and we&apos;ll get right back to you.</p>
          <NewTicketButton />
        </div>
      )}
    </>
  );
}
