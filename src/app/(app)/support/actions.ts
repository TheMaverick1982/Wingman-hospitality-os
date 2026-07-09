"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { notifySupportNewTicket, notifySupportReply } from "@/lib/support";

export type TicketState = { error: string | null };

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

  const { error: msgError } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticket.id, author_id: profile.userId, from_support: false, body: message });
  if (msgError) return { error: msgError.message };

  await notifySupportNewTicket({
    orgName: profile.orgName,
    fromName: profile.fullName,
    subject,
    body: message,
    ticketId: ticket.id,
  });

  revalidatePath("/support");
  redirect(`/support/${ticket.id}`);
}

export async function replyToTicket(ticketId: string, body: string): Promise<TicketState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  const text = String(body || "").trim();
  if (!text) return { error: "Write a reply first." };
  if (text.length > 10000) return { error: "Reply is too long." };
  if (!ticketId) return { error: "Missing ticket." };

  const supabase = await createClient();
  // RLS ensures the caller can only reply to a ticket in their org they can see.
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, subject, status")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return { error: "Ticket not found." };

  const { error } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticketId, author_id: profile.userId, from_support: false, body: text });
  if (error) return { error: error.message };

  // A customer reply reopens the ticket for the team and bumps activity.
  await supabase
    .from("support_tickets")
    .update({ status: "open", updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
    .eq("id", ticketId);

  await notifySupportReply({
    orgName: profile.orgName,
    fromName: profile.fullName,
    subject: (ticket as { subject: string }).subject,
    body: text,
    ticketId,
  });

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
