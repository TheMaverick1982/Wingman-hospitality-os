import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const ATTACHMENT_BUCKET = "ticket-attachments";
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_ATTACHMENTS = 5;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "application/pdf"]);

export type UploadedAttachment = { storage_path: string; filename: string; content_type: string; size_bytes: number };

// Validate + upload files to the private bucket. Returns the stored refs (to be
// written to ticket_attachments) or an error on the first bad/failed file.
export async function uploadTicketFiles(ticketId: string, files: File[]): Promise<{ uploaded: UploadedAttachment[]; error: string | null }> {
  const real = files.filter((f) => f && f.size > 0);
  if (real.length === 0) return { uploaded: [], error: null };
  if (real.length > MAX_ATTACHMENTS) return { uploaded: [], error: `Attach up to ${MAX_ATTACHMENTS} files.` };

  const admin = createAdminClient();
  const uploaded: UploadedAttachment[] = [];
  for (const file of real) {
    if (file.size > MAX_ATTACHMENT_BYTES) return { uploaded, error: `"${file.name}" is too large — 5MB max.` };
    if (!ALLOWED_TYPES.has(file.type)) return { uploaded, error: `"${file.name}": only images and PDFs are allowed.` };

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
    const path = `${ticketId}/${randomUUID()}-${safe}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from(ATTACHMENT_BUCKET).upload(path, buf, { contentType: file.type, upsert: false });
    if (error) return { uploaded, error: error.message };
    uploaded.push({ storage_path: path, filename: file.name.slice(0, 200), content_type: file.type, size_bytes: file.size });
  }
  return { uploaded, error: null };
}

// Short-lived signed URLs for private files, keyed by storage_path.
export async function signedUrlsFor(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}
