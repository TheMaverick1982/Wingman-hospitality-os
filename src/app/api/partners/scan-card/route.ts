import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { recordAiUsage } from "@/lib/ai/usage";

// Business-card scanner. Receives a photo, sends it to Claude vision to extract
// the contact fields, and returns them for the manager to review before saving.
//
// PRIVACY: the image is used for extraction ONLY. It is never written to storage
// or disk — it lives in memory for this single request and is discarded when the
// response returns. Only the parsed text fields leave this route.
export const maxDuration = 60;

const SCAN_MODEL = "claude-opus-4-8";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // ~6MB decoded

// Force structured output: the model must call this tool with the fields it
// reads off the card. Anything it can't find comes back as an empty string.
const EXTRACT_TOOL = {
  name: "save_card",
  description: "Return the contact details read from the business card.",
  input_schema: {
    type: "object",
    properties: {
      company_name: { type: "string", description: "Business / organization name. Empty string if none." },
      contact_name: { type: "string", description: "Person's full name. Empty string if none." },
      title: { type: "string", description: "Job title / role. Empty string if none." },
      email: { type: "string", description: "Email address. Empty string if none." },
      phone: { type: "string", description: "Best phone number (mobile if labeled). Empty string if none." },
      website: { type: "string", description: "Website URL. Empty string if none." },
      address: { type: "string", description: "Mailing / street address on the card. Empty string if none." },
    },
    required: ["company_name", "contact_name", "title", "email", "phone", "website", "address"],
  },
} as const;

type Fields = Record<"company_name" | "contact_name" | "title" | "email" | "phone" | "website" | "address", string>;

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.accessRole !== "super_admin" && profile.accessRole !== "manager") {
    return NextResponse.json({ error: "You don't have access to Partners." }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Card scanning isn't configured yet." }, { status: 503 });

  let body: { image?: string; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const base64 = (body.image ?? "").replace(/^data:[^;]+;base64,/, "").trim();
  if (!base64) return NextResponse.json({ error: "No image received." }, { status: 400 });
  // Rough decoded-size guard (base64 is ~4/3 of raw bytes).
  if (base64.length * 0.75 > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "That photo is too large — try again." }, { status: 413 });
  }
  const mediaType = ["image/jpeg", "image/png", "image/webp", "image/heic"].includes(body.mediaType ?? "")
    ? body.mediaType!
    : "image/jpeg";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: SCAN_MODEL,
        max_tokens: 512,
        tool_choice: { type: "tool", name: "save_card" },
        tools: [EXTRACT_TOOL],
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              {
                type: "text",
                text: "Read this business card and return the contact details via the save_card tool. Use empty strings for anything that isn't printed on the card. Don't invent values.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("scan-card Anthropic error", response.status, errText.slice(0, 300));
      return NextResponse.json({ error: "Couldn't read that card. Enter the details by hand." }, { status: 502 });
    }

    const data = (await response.json()) as {
      content: { type: string; name?: string; input?: Fields }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    await recordAiUsage({ orgId: profile.orgId, feature: "partner_scan_card", model: SCAN_MODEL, usage: data.usage });

    const toolUse = data.content.find((b) => b.type === "tool_use" && b.name === "save_card");
    const input = (toolUse?.input ?? {}) as Partial<Fields>;
    const fields: Fields = {
      company_name: (input.company_name ?? "").trim(),
      contact_name: (input.contact_name ?? "").trim(),
      title: (input.title ?? "").trim(),
      email: (input.email ?? "").trim(),
      phone: (input.phone ?? "").trim(),
      website: (input.website ?? "").trim(),
      address: (input.address ?? "").trim(),
    };
    return NextResponse.json({ fields });
  } catch (err) {
    console.error("scan-card failed", err);
    return NextResponse.json({ error: "Card scanning is unavailable right now." }, { status: 500 });
  }
}
