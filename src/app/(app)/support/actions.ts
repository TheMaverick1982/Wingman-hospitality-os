"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { notifySupportNewTicket, notifySupportReply } from "@/lib/support";
import { uploadTicketFiles } from "@/lib/support-attachments";

export type TicketState = { error: string | null };

function filesFrom(formData: FormData): File[] {
  return formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
}

async function saveAttachments(
  ticketId: string,
  messageId: string,
  files: File[],
  uploadedBy: string,
  fromSupport: boolean
): Promise<string | null> {
  if (files.length === 0) return null;
  const { uploaded, error } = await uploadTicketFiles(ticketId, files);
  if (error) return error;
  if (uploaded.length > 0) {
    const admin = createAdminClient();
    await admin.from("ticket_attachments").insert(
      uploaded.map((u) => ({
        ticket_id: ticketId,
        message_id: messageId,
        storage_path: u.storage_path,
        filename: u.filename,
        content_type: u.content_type,
        size_bytes: u.size_bytes,
        uploaded_by: uploadedBy,
        from_support: fromSupport,
      }))
    );
  }
  return null;
}

export async function createTicket(_prev: TicketState, formData: FormData): Promise<TicketState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  if (!subject) return { error: "Add a subject." };
  if (!message) return { error: "Describe what you need help with." };
  if (subject.length > 200) return { error: "Keep the subject under 200 characters." };
  if (message.length > 10000) return { error: "Message is too long." };

  const supabase = await createClient();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({ org_id: profile.orgId, created_by: profile.userId, subject })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { data: msg, error: msgError } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticket.id, author_id: profile.userId, from_support: false, body: message })
    .select("id")
    .single();
  if (msgError) return { error: msgError.message };

  const attachErr = await saveAttachments(ticket.id, msg.id, filesFrom(formData), profile.userId, false);
  if (attachErr) return { error: attachErr };

  await notifySupportNewTicket({ orgName: profile.orgName, fromName: profile.fullName, subject, body: message, ticketId: ticket.id });

  revalidatePath("/support");
  redirect(`/support/${ticket.id}`);
}

export async function replyToTicket(formData: FormData): Promise<TicketState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  const ticketId = String(formData.get("ticketId") || "");
  const text = String(formData.get("body") || "").trim();
  const files = filesFrom(formData);
  if (!ticketId) return { error: "Missing ticket." };
  if (!text && files.length === 0) return { error: "Write a reply or attach a file." };
  if (text.length > 10000) return { error: "Reply is too long." };

  const supabase = await createClient();
  const { data: ticket } = await supabase.from("support_tickets").select("id, subject").eq("id", ticketId).maybeSingle();
  if (!ticket) return { error: "Ticket not found." };

  const { data: msg, error } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticketId, author_id: profile.userId, from_support: false, body: text || "(sent an attachment)" })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const attachErr = await saveAttachments(ticketId, msg.id, files, profile.userId, false);
  if (attachErr) return { error: attachErr };

  await supabase
    .from("support_tickets")
    .update({ status: "open", updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
    .eq("id", ticketId);

  await notifySupportReply({ orgName: profile.orgName, fromName: profile.fullName, subject: (ticket as { subject: string }).subject, body: text || "(attachment)", ticketId });

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { error: null };
}

export async function setTicketStatus(ticketId: string, status: "open" | "closed"): Promise<TicketState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!ticketId) return { error: "Missing ticket." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) return { error: error.message };

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { error: null };
}
