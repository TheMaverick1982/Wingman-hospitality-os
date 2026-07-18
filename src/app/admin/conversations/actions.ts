"use server";

import { revalidatePath } from "next/cache";
import { sendConversationEmail, sendConversationSms } from "@/lib/conversations";

export async function sendEmailAction(contactId: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const res = await sendConversationEmail(contactId, subject, body);
  if (res.ok) {
    revalidatePath(`/admin/conversations/${contactId}`);
    revalidatePath("/admin/conversations");
  }
  return res;
}

export async function sendSmsAction(contactId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const res = await sendConversationSms(contactId, body);
  if (res.ok) {
    revalidatePath(`/admin/conversations/${contactId}`);
    revalidatePath("/admin/conversations");
  }
  return res;
}
