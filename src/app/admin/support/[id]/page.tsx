import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { signedUrlsFor } from "@/lib/support-attachments";
import { MessageAttachments, type AttachmentView } from "@/app/(app)/support/attachments";
import { AdminReplyForm } from "../admin-reply-form";

type Msg = { id: string; from_support: boolean; body: string; created_at: string; profiles: { full_name: string } | null };
type Att = { message_id: string | null; storage_path: string; filename: string; content_type: string };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformSection("support");
  const { id } = await params;
  const admin = createAdminClient();

  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, subject, status, organizations(name), profiles(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!ticket) notFound();

  const [{ data: messages }, { data: attachments }] = await Promise.all([
    admin.from("support_ticket_messages").select("id, from_support, body, created_at, profiles(full_name)").eq("ticket_id", id).order("created_at", { ascending: true }),
    admin.from("ticket_attachments").select("message_id, storage_path, filename, content_type").eq("ticket_id", id),
  ]);
  const msgs = (messages ?? []) as unknown as Msg[];
  const atts = (attachments ?? []) as Att[];
  const urls = await signedUrlsFor(atts.map((a) => a.storage_path));
  const byMessage = new Map<string, AttachmentView[]>();
  for (const a of atts) {
    if (!a.message_id) continue;
    const list = byMessage.get(a.message_id) ?? [];
    list.push({ filename: a.filename, url: urls.get(a.storage_path) ?? "", contentType: a.content_type });
    byMessage.set(a.message_id, list);
  }

  const t = ticket as unknown as { subject: string; status: "open" | "pending" | "closed"; organizations: { name: string } | null };

  return (
    <div className="max-w-2xl w-full mx-auto">
      <Link href="/admin/support" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink mb-6">
        <ArrowLeft size={15} /> All tickets
      </Link>

      <div className="mb-1 text-[13px] font-semibold text-brick uppercase tracking-wide">{t.organizations?.name ?? "Unknown org"}</div>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] text-ink mb-5">{t.subject}</h1>

      <div className="flex flex-col gap-3">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl border p-4 ${m.from_support ? "border-brick-tint bg-brick-tint/40" : "border-line bg-white"}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-semibold text-ink">
                {m.from_support ? `${m.profiles?.full_name ?? "Support"} · Wingman Support` : m.profiles?.full_name ?? "Customer"}
              </span>
              <span className="text-xs text-muted-2">
                {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <p className="text-[15px] leading-relaxed text-charcoal-2 whitespace-pre-wrap">{m.body}</p>
            <MessageAttachments items={byMessage.get(m.id) ?? []} />
          </div>
        ))}
      </div>

      <div className="mt-6">
        <AdminReplyForm ticketId={id} status={t.status} />
      </div>
    </div>
  );
}
