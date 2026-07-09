import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { StatusBadge } from "../status-badge";
import { ReplyForm } from "../reply-form";

export const maxDuration = 60;

type Msg = { id: string; from_support: boolean; body: string; created_at: string; profiles: { full_name: string } | null };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, subject, status")
    .eq("id", id)
    .maybeSingle();
  if (!ticket) notFound();

  const { data: messages } = await supabase
    .from("support_ticket_messages")
    .select("id, from_support, body, created_at, profiles(full_name)")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });
  const msgs = (messages ?? []) as unknown as Msg[];
  const status = (ticket as { status: "open" | "pending" | "closed" }).status;

  return (
    <div className="max-w-2xl w-full mx-auto">
      <Link href="/support" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink mb-6">
        <ArrowLeft size={15} /> All tickets
      </Link>

      <div className="flex items-start justify-between gap-4 mb-5">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-ink">{(ticket as { subject: string }).subject}</h1>
        <div className="pt-1.5">
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl border p-4 ${m.from_support ? "border-brick-tint bg-brick-tint/40" : "border-line bg-white"}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-semibold text-ink">
                {m.from_support ? "Wingman Support" : m.profiles?.full_name ?? "You"}
              </span>
              <span className="text-xs text-muted-2">
                {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <p className="text-[15px] leading-relaxed text-charcoal-2 whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <ReplyForm ticketId={id} status={status} />
      </div>
    </div>
  );
}
