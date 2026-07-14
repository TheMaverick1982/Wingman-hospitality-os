import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";
import { getPlatformPricing, dollars } from "@/lib/pricing";
import { captureLead } from "@/app/lead-actions";
import {
  SALES_MODEL,
  LEAD_CAPTURE_TOOL,
  salesSystemPrompt,
  type SalesMessage,
  type LeadCaptureInput,
} from "@/lib/sales-chat";

export const maxDuration = 30;

// Per-IP and global ceilings. The global bucket caps total sales-chat AI spend
// no matter how many IPs hit it — the backstop against credit farming on a
// public, unauthenticated endpoint.
const BURST_LIMIT = { max: 5, windowSeconds: 60 }; // stop rapid-fire loops (5 / IP / minute)
const IP_LIMIT = { max: 20, windowSeconds: 3600 }; // 20 messages / IP / hour
const GLOBAL_LIMIT = { max: 400, windowSeconds: 3600 }; // hard ceiling on total spend / hour
const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;

// Only serve requests that originate from our own site. Most credit-farming
// hits the API directly (not through the page), where the browser sends an
// Origin/Referer we can reject. Lenient when neither header is present (some
// privacy modes) — the rate limits still apply there.
function sameSite(headerList: Headers): boolean {
  const host = headerList.get("host");
  if (!host) return true;
  const matches = (u: string | null) => {
    if (!u) return null;
    try {
      return new URL(u).host === host;
    } catch {
      return false;
    }
  };
  const origin = matches(headerList.get("origin"));
  if (origin !== null) return origin;
  const referer = matches(headerList.get("referer"));
  if (referer !== null) return referer;
  return true;
}

type TextBlock = { type: "text"; text: string };
type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: LeadCaptureInput };
type ContentBlock = TextBlock | ToolUseBlock | { type: string };
type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

function textFrom(content: ContentBlock[]): string {
  return content
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function callAnthropic(apiKey: string, system: SystemBlock[], messages: unknown[]) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SALES_MODEL,
      max_tokens: 700,
      system,
      tools: [LEAD_CAPTURE_TOOL],
      messages,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API returned ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = (await response.json()) as { stop_reason: string; content: ContentBlock[]; usage?: { input_tokens?: number; output_tokens?: number } };
  await recordAiUsage({ orgId: null, feature: "sales_chat", model: SALES_MODEL, usage: data.usage });
  return data;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Chat isn't available right now." }, { status: 503 });
  }

  const headerList = await headers();
  if (!sameSite(headerList)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const ip = (headerList.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

  if (!(await consumeRateLimit(`sales-chat:burst:${ip}`, BURST_LIMIT.max, BURST_LIMIT.windowSeconds))) {
    return NextResponse.json({ error: "You're sending messages very fast — give it a second and try again." }, { status: 429 });
  }
  if (!(await consumeRateLimit(`sales-chat:ip:${ip}`, IP_LIMIT.max, IP_LIMIT.windowSeconds))) {
    return NextResponse.json({ error: "You've sent a lot of messages — please try again in a little while." }, { status: 429 });
  }
  if (!(await consumeRateLimit("sales-chat:global", GLOBAL_LIMIT.max, GLOBAL_LIMIT.windowSeconds))) {
    return NextResponse.json({ error: "Chat is busy right now — please try again shortly, or book a call." }, { status: 429 });
  }

  let history: SalesMessage[];
  try {
    const body = await request.json();
    history = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const messages: { role: "user" | "assistant"; content: unknown }[] = history
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Nothing to respond to." }, { status: 400 });
  }

  const pricing = await getPlatformPricing();
  const system: SystemBlock[] = [{ type: "text", text: salesSystemPrompt({ first: dollars(pricing.firstCents), addl: dollars(pricing.addlCents) }), cache_control: { type: "ephemeral" } }];

  try {
    const first = await callAnthropic(apiKey, system, messages);

    if (first.stop_reason !== "tool_use") {
      return NextResponse.json({ reply: textFrom(first.content) || "Sorry, could you rephrase that?", captured: false });
    }

    // The model wants to capture a lead. Store it, then let it write its confirmation.
    const toolUse = first.content.find((b): b is ToolUseBlock => b.type === "tool_use");
    let captured = false;
    let toolResultText = "Could not capture the lead.";
    if (toolUse?.input?.email) {
      const res = await captureLead({
        source: "sales-chat",
        email: toolUse.input.email,
        name: toolUse.input.name,
        payload: { via: "sales-chat", interest: toolUse.input.interest ?? null },
      });
      if (res.ok) {
        captured = true;
        toolResultText = "Lead captured. Confirm to the visitor in one short, warm sentence.";
      }
    }

    const followup = [
      ...messages,
      { role: "assistant" as const, content: first.content },
      { role: "user" as const, content: [{ type: "tool_result", tool_use_id: toolUse?.id ?? "", content: toolResultText }] },
    ];

    const second = await callAnthropic(apiKey, system, followup);
    return NextResponse.json({
      reply: textFrom(second.content) || (captured ? "Thanks — I've passed you to our team, they'll reach out shortly." : "Thanks!"),
      captured,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again, or book a call." }, { status: 500 });
  }
}
