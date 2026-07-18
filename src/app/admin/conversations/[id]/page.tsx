import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageSquare } from "lucide-react";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getThread, markConversationRead, type ThreadMessage } from "@/lib/conversations";
import { userSendMailbox } from "@/lib/mailbox";
import { ConversationComposer } from "./composer";

export const metadata: Metadata = { title: "Conversation · Admin" };

function ts(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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

export default async function ConversationThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformSection("crm");
  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) notFound();
  await markConversationRead(id); // opening the thread clears its unread state

  const { contact, messages } = thread;
  const hasPlaceholderEmail = contact.email.endsWith("@sms.wingman.local");
  const profile = await getCurrentProfile();
  const mailbox = profile ? await userSendMailbox(profile.userId) : null;

  return (
    <div className="flex flex-col gap-5 max-w-[760px]">
      <Link href="/admin/conversations" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink w-fit">
        <ArrowLeft size={15} /> Back to conversations
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{contact.name || contact.email}</h1>
        <p className="text-sm text-muted mt-1">
          {!hasPlaceholderEmail && contact.email}
          {!hasPlaceholderEmail && contact.phone ? " · " : ""}
          {contact.phone}
        </p>
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
  );
}
