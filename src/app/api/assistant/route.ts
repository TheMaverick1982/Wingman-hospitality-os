import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getPlatformPricing, dollars } from "@/lib/pricing";
import { consumeAiLimit, ASSISTANT_LIMIT } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";
import { notifySupportNewTicket } from "@/lib/support";
import {
  ASSISTANT_MODEL,
  REPORT_TOOL,
  systemInstructions,
  reportToTicket,
  type AssistantMessage,
  type ReportInput,
} from "@/lib/assistant";
import { buildRestaurantKnowledge } from "@/lib/assistant-knowledge";

export const maxDuration = 60;

// Anthropic content blocks we care about in a response.
type TextBlock = { type: "text"; text: string };
type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: ReportInput };
type ContentBlock = TextBlock | ToolUseBlock | { type: string };

const MAX_MESSAGES = 24; // cap conversation length sent to the model
const MAX_CHARS = 4000; // per-message guard

function textFrom(content: ContentBlock[]): string {
  return content
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function callAnthropic(apiKey: string, system: SystemBlock[], messages: unknown[], orgId: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ASSISTANT_MODEL,
      max_tokens: 1024,
      system,
      tools: [REPORT_TOOL],
      messages,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API returned ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = (await response.json()) as { stop_reason: string; content: ContentBlock[]; usage?: { input_tokens?: number; output_tokens?: number } };
  await recordAiUsage({ orgId, feature: "assistant", model: ASSISTANT_MODEL, usage: data.usage });
  return data;
}

type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The assistant isn't configured yet (missing ANTHROPIC_API_KEY)." },
      { status: 503 }
    );
  }

  if (!(await consumeAiLimit(profile, { bucketPrefix: "assistant", max: ASSISTANT_LIMIT.max, windowSeconds: ASSISTANT_LIMIT.windowSeconds }))) {
    return NextResponse.json(
      { error: "You've hit the hourly limit for the assistant. Please try again a bit later." },
      { status: 429 }
    );
  }

  let history: AssistantMessage[];
  try {
    const body = await request.json();
    history = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // Sanitize: keep only well-formed user/assistant turns, trim length.
  const messages: { role: "user" | "assistant"; content: unknown }[] = history
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Nothing to respond to." }, { status: 400 });
  }

  // Ground the assistant on THIS restaurant's own content so it can answer
  // "how do we do things here" (standards, menu, policies) — not just how to use
  // the app. Read through the user's RLS-scoped client and guarded, so it never
  // leaks another org's data and never takes down the assistant on a bad read.
  const supabase = await createClient();
  const knowledge = await buildRestaurantKnowledge(supabase, profile).catch(() => "");

  // The system prompt (help corpus + this org's knowledge) is prompt-cached
  // across turns of the conversation.
  const pricing = await getPlatformPricing();
  const system: SystemBlock[] = [
    {
      type: "text",
      text: systemInstructions(profile.accessRole, {
        pricing: { firstPrice: dollars(pricing.firstCents), addlPrice: dollars(pricing.addlCents) },
        knowledge,
      }),
      cache_control: { type: "ephemeral" },
    },
  ];

  try {
    const first = await callAnthropic(apiKey, system, messages, profile.orgId);

    // No tool call — return the plain answer.
    if (first.stop_reason !== "tool_use") {
      return NextResponse.json({ reply: textFrom(first.content) || "Sorry, I didn't catch that — could you rephrase?", reported: null });
    }

    // The model wants to file a report. Execute it, then let the model write its
    // confirmation with the tool result in hand.
    const toolUse = first.content.find((b): b is ToolUseBlock => b.type === "tool_use");
    let reported: { type: "bug" | "idea"; title: string } | null = null;
    let toolResultText = "Report received.";

    if (toolUse) {
      const r = toolUse.input;
      const { subject, body } = reportToTicket(r);
      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({ org_id: profile.orgId, created_by: profile.userId, subject })
        .select("id")
        .single();

      if (error || !ticket) {
        toolResultText = "Could not file the report right now.";
      } else {
        await supabase
          .from("support_ticket_messages")
          .insert({ ticket_id: ticket.id, author_id: profile.userId, from_support: false, body });
        await notifySupportNewTicket({ orgName: profile.orgName, fromName: profile.fullName, subject, body, ticketId: ticket.id });
        reported = { type: r.type, title: r.title };
        toolResultText = `Filed as support ticket ${ticket.id}. Confirm to the user in one short sentence.`;
      }
    }

    const followupMessages = [
      ...messages,
      { role: "assistant" as const, content: first.content },
      {
        role: "user" as const,
        content: [
          { type: "tool_result", tool_use_id: toolUse?.id ?? "", content: toolResultText },
        ],
      },
    ];

    const second = await callAnthropic(apiKey, system, followupMessages, profile.orgId);
    const reply =
      textFrom(second.content) ||
      (reported
        ? `Thanks — I've reported that ${reported.type === "bug" ? "issue" : "suggestion"} to the Wingman team.`
        : "Thanks — I've noted that.");

    return NextResponse.json({ reply, reported });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "The assistant hit an error. Please try again." },
      { status: 500 }
    );
  }
}
