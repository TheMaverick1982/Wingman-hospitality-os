import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { listConversations } from "@/lib/conversations";
import { InboxList } from "./inbox-list";

export const metadata: Metadata = { title: "Conversations · Admin" };

export default async function ConversationsPage() {
  await requirePlatformSection("crm");
  const rows = await listConversations();

  return (
    <div className="flex flex-col gap-5 max-w-[820px]">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Conversations</h1>
        <p className="text-sm text-muted mt-1">Every email and text with your contacts, in one place. Star the ones to follow up, and open a conversation to reply.</p>
      </div>

      <InboxList rows={rows} />
    </div>
  );
}
