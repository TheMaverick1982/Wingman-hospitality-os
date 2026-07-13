"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { consumeAiLimit } from "@/lib/rate-limit";

export type WizardState = { error: string | null };

type GeneratedSystem = {
  culture_statement: string;
  core_values: { title: string; description: string }[];
  preshift_focus: string;
  departments: Record<string, string[]>;
};

export async function generateAndApplySystem(_prev: WizardState, formData: FormData): Promise<WizardState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return { error: "Only a Super Admin can run the setup wizard." };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }

  const name = String(formData.get("name") || profile.orgName).trim();
  const concept = String(formData.get("concept") || "Casual / Family");
  const price = String(formData.get("price") || "$$");
  const greatService = String(formData.get("greatService") || "").trim();
  const painPoint = String(formData.get("painPoint") || "").trim();
  const signature = String(formData.get("signature") || "").trim();
  const depts = formData.getAll("depts").map(String) as Department[];
  const priorities = formData.getAll("priorities").map(String);

  const selectedDepts = ALL_DEPARTMENTS.filter((d) => depts.includes(d));
  if (selectedDepts.length === 0) {
    return { error: "Select at least one department." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };
  }

  const schema = `{"culture_statement": string, "core_values": [{"title": string, "description": string} x5], "preshift_focus": string, "departments": {${selectedDepts.map((d) => `"${d}": [string]`).join(", ")}}}`;
  const prompt = `Restaurant name: ${name}
Concept: ${concept}, price point: ${price}
What "great service" means to this operator: ${greatService || "not specified, infer from concept"}
Current #1 gap or complaint: ${painPoint || "not specified"}
Top guest experience priorities (in order of importance): ${priorities.length ? priorities.join(", ") : "general hospitality excellence"}
Signature touch or ritual they already do (weave this into relevant departments if given): ${signature || "none given"}
Departments to generate training for: ${selectedDepts.join(", ")}

Generate a complete guest-experience-driven hospitality system for this restaurant. Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
${schema}

Rules:
- culture_statement: 1-2 sentences, specific to this concept, in the voice of an operator, not generic corporate language.
- core_values: exactly 5, each title under 8 words, description under 20 words.
- preshift_focus: one sentence, a single concrete behavior to drill this week.
- departments: for each requested department, 6-8 checklist items. Each item under 14 words, phrased as a concrete observable action ("Ask X", "Do Y within Z seconds"), not a vague value statement. Guest experience (recognition, personalization, guiding the guest, creating a reason to return) must be embedded into EVERY department's list, including Chef, not just Host/Server. Reflect the stated priorities and signature touch where relevant.`;

  let generated: GeneratedSystem;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
        system: `You are an elite hospitality systems consultant who designs complete, world-class guest-experience operating systems for restaurants. Consistent, elevated hospitality is engineered through the disciplined combination of culture, training, and repeatable, inspected standards -- and is ultimately measured by guest retention and real revenue lift, not by good intentions.

${HOSPITALITY_DOCTRINE}

Draw on these principles to shape the culture statement, core values, per-department standards, and the pre-shift focus. You output only valid JSON matching the requested schema exactly. Never include markdown code fences or any text outside the JSON object.`,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic API returned ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
    generated = JSON.parse(cleaned);

    if (!generated.departments || !generated.core_values || generated.core_values.length === 0) {
      throw new Error("The generator returned an incomplete response. Try again.");
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed. Try again." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { error: orgError } = await supabase
    .from("organizations")
    .update({
      name,
      philosophy: generated.culture_statement,
      weekly_focus: generated.preshift_focus,
      system_generated: true,
    })
    .eq("id", org.id);
  if (orgError) return { error: orgError.message };

  await supabase.from("core_values").delete().eq("org_id", org.id);
  const { error: coreValuesError } = await supabase.from("core_values").insert(
    generated.core_values.slice(0, 5).map((v, i) => ({
      org_id: org.id,
      title: v.title,
      description: v.description,
      sort_order: i,
    }))
  );
  if (coreValuesError) return { error: coreValuesError.message };

  for (const dept of selectedDepts) {
    const items = generated.departments[dept];
    if (!items || items.length === 0) continue;
    await supabase.from("department_standards").delete().eq("org_id", org.id).eq("department", dept);
    const { error: standardsError } = await supabase.from("department_standards").insert(
      items.map((item, i) => ({ org_id: org.id, department: dept, item, sort_order: i }))
    );
    if (standardsError) return { error: standardsError.message };
  }

  revalidatePath("/culture");
  revalidatePath("/training");
  revalidatePath("/hiring");
  revalidatePath("/dashboard");
  redirect("/start-here");
}
