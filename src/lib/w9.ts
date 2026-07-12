import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// W-9 collection helpers. The returned form holds a taxpayer ID, so files live
// in a PRIVATE bucket and are only ever served via short-lived signed URLs.

export const TAX_FORM_BUCKET = "tax-forms";
export const W9_FORM_URL = "https://www.irs.gov/pub/irs-pdf/fw9.pdf"; // official IRS blank W-9
export const MAX_W9_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg"]);

// Validate + store a returned W-9 for a staff member. Returns the storage path.
export async function uploadW9File(profileId: string, file: File): Promise<{ path: string | null; error: string | null }> {
  if (!file || file.size === 0) return { path: null, error: "Choose a file to upload." };
  if (file.size > MAX_W9_BYTES) return { path: null, error: "That file is too large — 10MB max." };
  if (!ALLOWED_TYPES.has(file.type)) return { path: null, error: "Upload a PDF or an image of the W-9." };

  const admin = createAdminClient();
  const ext = file.type === "application/pdf" ? "pdf" : file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "img";
  const path = `${profileId}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(TAX_FORM_BUCKET).upload(path, buf, { contentType: file.type, upsert: false });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

// A short-lived signed URL to view a stored W-9.
export async function signedW9Url(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(TAX_FORM_BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

// The email that asks a rep to complete and return their W-9.
export function w9RequestEmailHtml(name: string, returnToEmail: string): string {
  const hi = name ? `Hi ${name.split(" ")[0]},` : "Hi there,";
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:560px;">
    <p style="font-size:16px;font-weight:600;">One quick form before we can pay you 🛬</p>
    <p style="font-size:14px;color:#333;">${hi}</p>
    <p style="font-size:14px;color:#333;">Welcome to the Wingman team! Before we can send any commission payments, we need a completed <strong>IRS Form W-9</strong> on file — it's the standard form for contractors.</p>
    <ol style="font-size:14px;color:#333;line-height:1.6;">
      <li>Download the blank form here: <a href="${W9_FORM_URL}" style="color:#0a6cff;font-weight:600;">IRS Form W-9 (PDF)</a></li>
      <li>Fill it out and sign it.</li>
      <li>Reply to this email with the completed form attached, or send it to <a href="mailto:${returnToEmail}" style="color:#0a6cff;">${returnToEmail}</a>.</li>
    </ol>
    <p style="font-size:13px;color:#777;">Your information is kept private and used only for tax reporting. Thanks!</p>
  </div>`;
}
