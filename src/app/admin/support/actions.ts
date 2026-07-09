"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { notifyCustomerReply } from "@/lib/support";
import { uploadTicketFiles } from "@/lib/support-attachments";

export type AdminTicketState = { error: string | null };

async function requirePlatformAdmin() {
  return platformSectionActor("support");
}

export async function adminReply(formData: FormData): Promise<AdminTicketState> {
  const profile = await requirePlatformAdmin();
  if (!profile) return { error: "Not authorized." };
  const ticketId = String(formData.get("ticketId") || "");
  const text = String(formData.get("body") || "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!ticketId) return { error: "Missing ticket." };
  if (!text && files.length === 0) return { error: "Write a reply or attach a file." };
  if (text.length > 10000) return { error: "Reply is too long." };

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, subject, created_by")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return { error: "Ticket not found." };

  const { data: msg, error } = await admin
    .from("support_ticket_messages")
    .insert({ ticket_id: ticketId, author_id: profile.userId, from_support: true, body: text || "(sent an attachment)" })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (files.length > 0) {
    const { uploaded, error: upErr } = await uploadTicketFiles(ticketId, files);
    if (upErr) return { error: upErr };
    if (uploaded.length > 0) {
      await admin.from("ticket_attachments").insert(
        uploaded.map((u) => ({
          ticket_id: ticketId,
          message_id: msg.id,
          storage_path: u.storage_path,
          filename: u.filename,
          content_type: u.content_type,
          size_bytes: u.size_bytes,
          uploaded_by: profile.userId,
          from_support: true,
        }))
      );
    }
  }

  // A support reply moves the ticket to "pending" (awaiting the customer).
  await admin
    .from("support_tickets")
    .update({ status: "pending", updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
    .eq("id", ticketId);

  // Email the customer who filed it.
  const createdBy = (ticket as { created_by: string | null }).created_by;
  if (createdBy) {
    try {
      const { data } = await admin.auth.admin.getUserById(createdBy);
      const email = data?.user?.email;
      if (email) {
        await notifyCustomerReply({ toEmail: email, subject: (ticket as { subject: string }).subject, body: text || "(attachment)", ticketId });
      }
    } catch {
      /* notification is best-effort */
    }
  }

  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  return { error: null };
}

export async function adminSetStatus(ticketId: string, status: "open" | "pending" | "closed"): Promise<AdminTicketState> {
  const profile = await requirePlatformAdmin();
  if (!profile) return { error: "Not authorized." };
  if (!ticketId) return { error: "Missing ticket." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  return { error: null };
}
