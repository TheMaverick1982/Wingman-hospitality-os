import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageSquare } from "lucide-react";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { listConversations } from "@/lib/conversations";

export const metadata: Metadata = { title: "Conversations · Admin" };

function whenLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ConversationsPage() {
  await requirePlatformSection("crm");
  const rows = await listConversations();

  return (
    <div className="flex flex-col gap-5 max-w-[820px]">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Conversations</h1>
        <p className="text-sm text-muted mt-1">Every email and text with your contacts, in one place. Open a conversation to reply.</p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted">
          No conversations yet. They appear here once you email or text a contact — or one texts you back.
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl overflow-hidden divide-y divide-line">
          {rows.map((r) => (
            <Link key={r.id} href={`/admin/conversations/${r.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-paper transition-colors">
              {r.unread ? <span className="w-2 h-2 rounded-full bg-brick shrink-0" /> : <span className="w-2 h-2 shrink-0" />}
              <span className="shrink-0 text-muted-2">
                {r.lastKind.startsWith("sms") ? <MessageSquare size={15} /> : <Mail size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-sm truncate ${r.unread ? "font-bold text-ink" : "font-semibold text-ink"}`}>{r.name || r.email}</span>
                  <span className="text-[12px] text-muted-2 whitespace-nowrap shrink-0">{whenLabel(r.lastMessageAt)}</span>
                </div>
                <div className="text-[13px] text-muted truncate">{r.preview || "—"}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
