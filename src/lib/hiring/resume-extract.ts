import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiUsage } from "@/lib/ai/usage";

// One-time resume → plain-text extraction. Claude reads the uploaded PDF/image
// directly (no separate OCR system), and we store the text once so the "Ask
// about your applicants" feature can search it on every question. A background
// cron drives this; the apply flow stays instant.

const EXTRACT_MODEL = "claude-haiku-4-5-20251001";

// Media types Claude can read directly. Anything else (e.g. .docx) is marked
// processed-with-no-text so the cron doesn't retry it forever.
function mediaTypeFor(path: string): { kind: "document" | "image"; mediaType: string } | null {
  const ext = (path.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return { kind: "document", mediaType: "application/pdf" };
  if (ext === "jpg" || ext === "jpeg") return { kind: "image", mediaType: "image/jpeg" };
  if (ext === "png") return { kind: "image", mediaType: "image/png" };
  if (ext === "webp") return { kind: "image", mediaType: "image/webp" };
  if (ext === "gif") return { kind: "image", mediaType: "image/gif" };
  return null;
}

// Extract the text of one resume file. Returns the text, or "" when the file type
// isn't readable (a permanent skip), or null on a transient failure (retry later).
export async function extractResumeText(orgId: string, resumePath: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const media = mediaTypeFor(resumePath);
  if (!media) return ""; // unsupported type — nothing to extract, don't retry.

  const admin = createAdminClient();
  const { data: file, error } = await admin.storage.from("resumes").download(resumePath);
  if (error || !file) return null; // transient (missing/permission) — retry later.

  let base64: string;
  try {
    base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
  // Guard against oversized payloads (Claude base64 limits); resumes are capped at
  // 8MB on upload, which is within range, but bail defensively on anything larger.
  if (base64.length > 14_000_000) return "";

  const source = { type: "base64" as const, media_type: media.mediaType, data: base64 };
  const block =
    media.kind === "document"
      ? { type: "document", source }
      : { type: "image", source };
  const instruction =
    "Extract ALL text from this resume as plain text, verbatim — names, contact info, work history, titles, dates, skills, education. Keep it readable top to bottom. Do not summarize, comment, or add anything. If the file has no readable text, reply with exactly: NO_TEXT";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        max_tokens: 2500,
        messages: [{ role: "user", content: [block, { type: "text", text: instruction }] }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await recordAiUsage({ orgId, feature: "resume_extract", model: EXTRACT_MODEL, usage: data.usage }).catch(() => undefined);
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    if (!text || text === "NO_TEXT") return "";
    return text.slice(0, 12000);
  } catch {
    return null;
  }
}

// Process a batch of applications that have a resume on file but no extracted text
// yet (new applications and the initial backfill both flow through here). Bounded
// per run to control cost/time.
export async function extractPendingResumes(limit = 40): Promise<{ processed: number; withText: number }> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("job_applications")
    .select("id, org_id, resume_path")
    .not("resume_path", "is", null)
    .is("resume_text", null)
    .limit(limit);
  const pending = (rows ?? []) as { id: string; org_id: string; resume_path: string }[];

  let processed = 0;
  let withText = 0;
  for (const r of pending) {
    const text = await extractResumeText(r.org_id, r.resume_path);
    if (text === null) continue; // transient failure — leave null to retry next run.
    await admin.from("job_applications").update({ resume_text: text }).eq("id", r.id);
    processed++;
    if (text) withText++;
  }
  return { processed, withText };
}
