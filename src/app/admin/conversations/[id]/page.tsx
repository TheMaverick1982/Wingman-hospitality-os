import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageSquare, ExternalLink } from "lucide-react";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getThread, markConversationRead, type ThreadMessage, type ThreadContact } from "@/lib/conversations";
import { userSendMailbox } from "@/lib/mailbox";
import { listSalesReps } from "@/lib/sales-reps";
import { CRM_STAGES, sourceLabel } from "@/lib/crm";
import { ConversationComposer } from "./composer";
import { ConversationStar } from "../conversation-star";

export const metadata: Metadata = { title: "Conversation · Admin" };

function ts(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function displayTag(tag: string): string {
  if (tag.startsWith("src:")) return sourceLabel(tag.slice(4));
  if (tag.startsWith("aff:")) return `Affiliate: ${tag.slice(4)}`;
  return tag;
}

function Bubble({ m }: { m: ThreadMessage }) {
  const outbound = m.kind === "email_out" || m.kind === "sms_out";
  const isSms = m.kind.startsWith("sms");
  return (
    <div className={`flex flex-col ${outbound ? "items-end" : "items-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${outbound ? "bg-brick text-white" : "bg-white border border-line text-ink"}`}>
        {!isSms && m.subject && <div className={`text-[12px] font-semibold mb-1 ${outbound ? "text-white/90" : "text-muted-2"}`}>{m.subject}</div>}
        <div className="text-[14px] leading-[1.5] whitespace-pre-wrap break-words">{m.body}</div>
      </div>
      <div className="text-[11px] text-muted-2 mt-1 inline-flex items-center gap-1">
        {isSms ? <MessageSquare size={11} /> : <Mail size={11} />}
        {outbound ? "You" : "Them"} · {ts(m.created_at)}
      </div>
    </div>
  );
}

function ContactPanel({ contact, ownerName, hidePlaceholderEmail }: { contact: ThreadContact; ownerName: string | null; hidePlaceholderEmail: boolean }) {
  const stageLabel = CRM_STAGES.find((s) => s.key === contact.stage)?.label ?? contact.stage;
  const tags = (contact.tags ?? []).map(displayTag);
  const rows: { label: string; value: string }[] = [
    { label: "Stage", value: stageLabel },
    { label: "Owner", value: ownerName ?? "Unassigned" },
    { label: "Source", value: sourceLabel(contact.first_source) },
    { label: "Added", value: new Date(contact.created_at).toLocaleDateString() },
  ];
  return (
    <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-4 lg:sticky lg:top-5">
      <div className="flex items-center gap-3">
        <span className="shrink-0 w-11 h-11 rounded-full bg-ink text-white flex items-center justify-center text-sm font-semibold">
          {(contact.name || contact.email).slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink truncate">{contact.name || contact.email}</div>
          {!hidePlaceholderEmail && <div className="text-[12.5px] text-muted-2 truncate">{contact.email}</div>}
        </div>
      </div>

      <dl className="flex flex-col gap-2.5 text-[13px]">
        {!hidePlaceholderEmail && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-2">Email</dt>
            <dd className="text-ink font-medium text-right truncate">{contact.email}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-2">Phone</dt>
          <dd className="text-ink font-medium text-right">{contact.phone || "—"}</dd>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3">
            <dt className="text-muted-2">{r.label}</dt>
            <dd className="text-ink font-medium text-right">{r.value}</dd>
          </div>
        ))}
        {contact.unsubscribed && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-2">Status</dt>
            <dd className="text-danger font-medium text-right">Unsubscribed</dd>
          </div>
        )}
      </dl>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t, i) => (
            <span key={i} className="text-[11px] font-medium text-olive bg-olive-tint px-2 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      )}

      <Link href={`/admin/crm/${contact.id}`} className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-charcoal-2 bg-paper border border-line rounded-lg px-3 py-2 hover:bg-white transition-colors">
        Open full contact <ExternalLink size={13} />
      </Link>
    </div>
  );
}

export default async function ConversationThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformSection("crm");
  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) notFound();
  await markConversationRead(id); // opening the thread clears its unread state

  const { contact, messages } = thread;
  const hasPlaceholderEmail = contact.email.endsWith("@sms.wingman.local");
  const profile = await getCurrentProfile();
  const [mailbox, reps] = await Promise.all([profile ? userSendMailbox(profile.userId) : Promise.resolve(null), listSalesReps()]);
  const ownerName = contact.assigned_rep_id ? reps.find((r) => r.id === contact.assigned_rep_id)?.name ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/conversations" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink w-fit">
        <ArrowLeft size={15} /> Back to conversations
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        {/* Thread + composer */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink truncate">{contact.name || contact.email}</h1>
              <p className="text-sm text-muted mt-1">
                {!hasPlaceholderEmail && contact.email}
                {!hasPlaceholderEmail && contact.phone ? " · " : ""}
                {contact.phone}
              </p>
            </div>
            <ConversationStar contactId={contact.id} starred={contact.starred} size={22} />
          </div>

          <div className="flex flex-col gap-3 bg-paper border border-line rounded-2xl p-5 min-h-[200px]">
            {messages.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No messages yet — send the first one below.</p>
            ) : (
              messages.map((m) => <Bubble key={m.id} m={m} />)
            )}
          </div>

          <ConversationComposer
            contactId={contact.id}
            hasEmail={!hasPlaceholderEmail && !!contact.email}
            hasPhone={!!contact.phone}
            fromMailbox={mailbox?.email ?? null}
          />
        </div>

        {/* Contact details */}
        <ContactPanel contact={contact} ownerName={ownerName} hidePlaceholderEmail={hasPlaceholderEmail} />
      </div>
    </div>
  );
}
