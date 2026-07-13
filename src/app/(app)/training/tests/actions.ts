"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { EXAMPLE_TESTS, type QuestionKind, type TestMode, type TestQuestion, type TestSettings } from "@/lib/tests";

async function canBuild() {
  const p = await getCurrentProfile();
  return p && canEditSection(p.accessRole, "training", p.permissionOverrides) ? p : null;
}

// A day of the proposed test: study content + its questions.
export type ProposedDay = { day_number: number; title: string; content: string; questions: TestQuestion[] };
export type ProposeState = { error: string | null; days?: ProposedDay[]; summary?: string; settings?: TestSettings };

function readSettings(formData: FormData): TestSettings {
  const mode = (String(formData.get("mode") || "exam") === "study_quiz" ? "study_quiz" : "exam") as TestMode;
  const dayCount = Math.max(1, Math.min(30, Number(formData.get("day_count")) || 1));
  const passPct = Math.max(1, Math.min(100, Number(formData.get("pass_pct")) || 80));
  const maxRetakes = Math.max(0, Math.min(10, Number(formData.get("max_retakes")) || 0));
  const amountRaw = Number(formData.get("complete_within_amount"));
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.round(amountRaw) : null;
  const unit = String(formData.get("complete_within_unit") || "days") === "hours" ? "hours" : "days";
  const targets = formData.getAll("target_departments").map(String).filter((d) => ALL_DEPARTMENTS.includes(d as Department));
  return {
    title: String(formData.get("title") || "").trim().slice(0, 120),
    description: String(formData.get("description") || "").trim().slice(0, 500),
    mode,
    target_departments: targets,
    day_count: dayCount,
    pass_pct: passPct,
    max_retakes: maxRetakes,
    complete_within_amount: amount,
    complete_within_unit: unit,
    rotates_monthly: formData.get("rotates_monthly") === "on",
  };
}

async function callModel(system: string, prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Wingman's AI is temporarily unavailable. Please try again in a moment.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API returned ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
}

function extractJson(text: string): string {
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
}

const TEST_SYSTEM = `You are an elite hospitality training designer. You write clear teaching content and fair, unambiguous quiz questions that check real understanding — never trick questions, never vague ones. Each question has exactly one correct answer.

${HOSPITALITY_DOCTRINE}

You output only valid JSON matching the requested schema exactly. Never include markdown code fences or any text outside the JSON object.`;

type RawQ = { kind?: string; prompt?: string; options?: string[]; correct_index?: number; explanation?: string };
type RawDay = { day_number?: number; title?: string; content?: string; questions?: RawQ[] };

function normalizeDays(raw: RawDay[], dayCount: number, mode: TestMode): ProposedDay[] {
  const days: ProposedDay[] = [];
  for (let d = 1; d <= dayCount; d++) {
    const src = raw.find((x) => Number(x.day_number) === d) ?? raw[d - 1] ?? {};
    const questions: TestQuestion[] = (src.questions ?? [])
      .filter((q) => String(q.prompt ?? "").trim())
      .slice(0, 12)
      .map((q, i) => {
        const kind: QuestionKind = q.kind === "true_false" ? "true_false" : "multiple_choice";
        const options = kind === "true_false" ? ["True", "False"] : (q.options ?? []).map((o) => String(o).slice(0, 200)).filter(Boolean).slice(0, 6);
        const ci = Math.max(0, Math.min((kind === "true_false" ? 2 : options.length) - 1, Number(q.correct_index) || 0));
        return {
          day_number: d,
          sort_order: i,
          kind,
          prompt: String(q.prompt).slice(0, 500),
          options: kind === "multiple_choice" && options.length < 2 ? ["", ""] : options,
          correct_index: ci,
          explanation: String(q.explanation ?? "").slice(0, 400),
        };
      })
      .filter((q) => q.kind === "true_false" || q.options.length >= 2);
    days.push({
      day_number: d,
      title: String(src.title ?? `Day ${d}`).slice(0, 120),
      content: mode === "study_quiz" ? String(src.content ?? "").slice(0, 4000) : String(src.content ?? "").slice(0, 1000),
      questions,
    });
  }
  return days;
}

// Build a test from a topic + optional pasted material. Returns a PREVIEW the
// owner reviews and approves — nothing is saved until they do.
export async function proposeTest(_prev: ProposeState, formData: FormData): Promise<ProposeState> {
  const profile = await canBuild();
  if (!profile) return { error: "You don't have access to build tests." };
  if (!(await consumeAiLimit(profile))) return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };

  const settings = readSettings(formData);
  if (!settings.title) return { error: "Give the test a title." };
  const topic = String(formData.get("topic") || "").trim().slice(0, 2000);
  const material = String(formData.get("material") || "").trim().slice(0, 12000);
  if (!topic && !material) return { error: "Add a topic to cover, or paste your existing material." };

  const schema = `{"summary": string, "days": [{"day_number": number, "title": string, "content": string, "questions": [{"kind": "multiple_choice" | "true_false", "prompt": string, "options": [string], "correct_index": number, "explanation": string}]}]}`;
  const teach = settings.mode === "study_quiz";
  const prompt = `Build a ${settings.day_count}-day ${teach ? "learn-then-quiz" : "exam"} titled "${settings.title}".
${settings.description ? `What it's for: ${settings.description}` : ""}
${settings.target_departments.length ? `Who takes it: ${settings.target_departments.join(", ")}` : "Who takes it: all staff"}
${topic ? `\nTopic to cover:\n${topic}\n` : ""}${material ? `\nUse and improve the operator's existing material below — organize it, fill gaps, and base the questions on it:\n"""\n${material}\n"""\n` : ""}
Split the material sensibly across ${settings.day_count} day${settings.day_count === 1 ? "" : "s"}. For EACH day give:
- a short "title" for that day's focus.
- ${teach ? '"content": clear teaching/study text the employee reads BEFORE the questions (a few tight paragraphs or bullet lines). This is a learn-then-quiz, so teach well.' : '"content": one or two lines of context (keep it short — this is an exam, not a lesson).'}
- "questions": 3-6 auto-scored questions. Use "multiple_choice" (3-4 plausible options, exactly one correct) or "true_false" (options MUST be exactly ["True","False"]). Set "correct_index" to the 0-based index of the correct option. Add a one-line "explanation" of why it's right. Questions must be fair, unambiguous, and check real understanding.

Also give a one-sentence "summary". Respond with ONLY valid JSON, no markdown fences, matching exactly:
${schema}`;

  try {
    const text = await callModel(TEST_SYSTEM, prompt, 8000);
    const cleaned = extractJson(text);
    let parsed: { summary?: string; days?: RawDay[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const lastObj = cleaned.lastIndexOf("}");
      const arrStart = cleaned.indexOf("[");
      if (lastObj > arrStart && arrStart !== -1) parsed = JSON.parse(cleaned.slice(0, lastObj + 1) + "]}");
      else throw new Error("The test was cut short while generating. Try fewer days or shorter material.");
    }
    const days = normalizeDays(parsed.days ?? [], settings.day_count, settings.mode);
    if (days.every((d) => d.questions.length === 0)) throw new Error("The generator returned no questions. Try again.");
    return { error: null, days, summary: String(parsed.summary ?? "").slice(0, 300), settings };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed. Try again." };
  }
}

// Persist a reviewed/approved test (settings + its days + questions).
export async function applyTest(settings: TestSettings, days: ProposedDay[], source = "ai", sourceDepartment?: string): Promise<{ error: string | null; id?: string }> {
  const profile = await canBuild();
  if (!profile) return { error: "Not authorized." };
  if (!settings.title?.trim()) return { error: "Give the test a title." };
  if (!Array.isArray(days) || days.length === 0) return { error: "Nothing to save." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const insertObj: Record<string, unknown> = {
    org_id: org.id,
    title: settings.title.trim().slice(0, 120),
    description: (settings.description || "").slice(0, 500),
    mode: settings.mode,
    target_departments: settings.target_departments.filter((d) => ALL_DEPARTMENTS.includes(d as Department)),
    day_count: Math.max(1, Math.min(30, settings.day_count)),
    pass_pct: settings.pass_pct,
    max_retakes: settings.max_retakes,
    complete_within_amount: settings.complete_within_amount,
    complete_within_unit: settings.complete_within_unit,
    rotates_monthly: settings.rotates_monthly,
    source,
    created_by: profile.userId,
  };
  // Only reference the column when set, so the common build paths don't depend
  // on the source_department migration having landed.
  if (sourceDepartment) insertObj.source_department = sourceDepartment;

  const { data: test, error } = await supabase.from("tests").insert(insertObj).select("id").single();
  if (error) return { error: error.message };
  const testId = test.id as string;

  const dayRows = days.map((d) => ({ test_id: testId, org_id: org.id, day_number: d.day_number, title: d.title.slice(0, 120), content: (d.content || "").slice(0, 4000) }));
  await supabase.from("test_days").insert(dayRows);

  const qRows = days.flatMap((d) =>
    d.questions.map((q, i) => ({
      test_id: testId,
      org_id: org.id,
      day_number: d.day_number,
      sort_order: i,
      kind: q.kind,
      prompt: q.prompt.slice(0, 500),
      options: q.options,
      correct_index: q.correct_index,
      explanation: (q.explanation || "").slice(0, 400),
    }))
  );
  if (qRows.length > 0) await supabase.from("test_questions").insert(qRows);

  revalidatePath("/training/tests");
  return { error: null, id: testId };
}

// Drop in one of the built-in starter tests (Food Test / Bartender Test).
export async function createExampleTest(key: string): Promise<{ error: string | null; id?: string }> {
  const example = EXAMPLE_TESTS.find((e) => e.key === key);
  if (!example) return { error: "Unknown example." };
  const days: ProposedDay[] = example.days.map((d) => ({
    day_number: d.day_number,
    title: d.title,
    content: d.content,
    questions: example.questions.filter((q) => q.day_number === d.day_number),
  }));
  return applyTest(example.settings, days, "example");
}

// Turn an existing department's training into a test — the AI writes questions
// from their standards + training items, returned as a preview to approve.
export async function proposeTestFromTraining(_prev: ProposeState, formData: FormData): Promise<ProposeState> {
  const profile = await canBuild();
  if (!profile) return { error: "You don't have access to build tests." };
  const department = String(formData.get("department") || "");
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Pick a role." };
  if (!(await consumeAiLimit(profile))) return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };

  const supabase = await createClient();
  const [{ data: standards }, { data: items }] = await Promise.all([
    supabase.from("department_standards").select("item").eq("department", department).order("sort_order"),
    supabase.from("department_training_items").select("item").eq("department", department).order("sort_order"),
  ]);
  const material = [
    ...(standards ?? []).map((s) => `- ${(s as { item: string }).item}`),
    ...(items ?? []).map((s) => `- ${(s as { item: string }).item}`),
  ].join("\n");
  if (!material.trim()) return { error: `No training content found for ${department} yet — build its training first.` };

  const settings: TestSettings = {
    title: `${department} Training Test`,
    description: `Checks that ${department} team members know their training standards.`,
    mode: "exam",
    target_departments: [department],
    day_count: 1,
    pass_pct: 80,
    max_retakes: 1,
    complete_within_amount: 3,
    complete_within_unit: "days",
    rotates_monthly: false,
  };

  const schema = `{"summary": string, "days": [{"day_number": 1, "title": string, "content": string, "questions": [{"kind": "multiple_choice" | "true_false", "prompt": string, "options": [string], "correct_index": number, "explanation": string}]}]}`;
  const prompt = `Write a one-day knowledge test for the ${department} role based ONLY on this restaurant's own training standards below. Write 6-10 fair, auto-scored questions (multiple_choice with one correct option, or true_false with options exactly ["True","False"]) that verify the person actually learned these standards. Set correct_index (0-based) and a one-line explanation each.

Training standards:
"""
${material.slice(0, 8000)}
"""

Respond with ONLY valid JSON, matching exactly:
${schema}`;

  try {
    const text = await callModel(TEST_SYSTEM, prompt, 6000);
    const parsed = JSON.parse(extractJson(text)) as { summary?: string; days?: RawDay[] };
    const days = normalizeDays(parsed.days ?? [], 1, "exam");
    if (days[0]?.questions.length === 0) throw new Error("Couldn't write questions from that training. Try again.");
    return { error: null, days, summary: String(parsed.summary ?? "").slice(0, 300), settings };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed. Try again." };
  }
}

// One-click "turn this role's training into a test" (or update the one already
// made from it), straight from the Training page. Generates fresh questions from
// the role's current standards and pushes the test into the prebuilt tests area,
// ready to assign. Keeps a single test per role via source_department.
export async function createOrUpdateTestFromRole(department: string): Promise<{ error: string | null; id?: string; updated?: boolean }> {
  const profile = await canBuild();
  if (!profile) return { error: "You don't have access to build tests." };
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Pick a role." };
  if (!(await consumeAiLimit(profile))) return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const [{ data: standards }, { data: items }] = await Promise.all([
    supabase.from("department_standards").select("item").eq("department", department).order("sort_order"),
    supabase.from("department_training_items").select("item").eq("department", department).order("sort_order"),
  ]);
  const material = [
    ...(standards ?? []).map((s) => `- ${(s as { item: string }).item}`),
    ...(items ?? []).map((s) => `- ${(s as { item: string }).item}`),
  ].join("\n");
  if (!material.trim()) return { error: `No training content found for ${department} yet — build its training first.` };

  const schema = `{"days": [{"day_number": 1, "title": string, "content": string, "questions": [{"kind": "multiple_choice" | "true_false", "prompt": string, "options": [string], "correct_index": number, "explanation": string}]}]}`;
  const prompt = `Build a learn-then-quiz for the ${department} role based ONLY on this restaurant's own training standards below.
Give ONE day with:
- "title": a short focus for the day.
- "content": clear teaching/study text the employee reads BEFORE the questions — a few tight paragraphs or bullet lines that actually teach these standards, so someone could learn from it and then pass. This is the learning section.
- "questions": 6-10 fair, auto-scored questions (multiple_choice with one correct option, or true_false with options exactly ["True","False"]) that check they learned the content. Set correct_index (0-based) and a one-line explanation each.

Training standards:
"""
${material.slice(0, 8000)}
"""

Respond with ONLY valid JSON, matching exactly:
${schema}`;

  let days: ProposedDay[];
  try {
    const text = await callModel(TEST_SYSTEM, prompt, 7000);
    const parsed = JSON.parse(extractJson(text)) as { days?: RawDay[] };
    days = normalizeDays(parsed.days ?? [], 1, "study_quiz");
    if (!days[0] || days[0].questions.length === 0) throw new Error("Couldn't write questions from that training. Try again.");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed. Try again." };
  }

  // Already made into a test? Replace its content, keep its settings.
  const { data: existing } = await supabase.from("tests").select("id").eq("org_id", org.id).eq("source_department", department).maybeSingle();
  if (existing) {
    const testId = (existing as { id: string }).id;
    await supabase.from("test_questions").delete().eq("test_id", testId);
    await supabase.from("test_days").delete().eq("test_id", testId);
    await supabase.from("test_days").insert(days.map((d) => ({ test_id: testId, org_id: org.id, day_number: d.day_number, title: d.title.slice(0, 120), content: (d.content || "").slice(0, 4000) })));
    const qRows = days.flatMap((d) => d.questions.map((q, i) => ({ test_id: testId, org_id: org.id, day_number: d.day_number, sort_order: i, kind: q.kind, prompt: q.prompt.slice(0, 500), options: q.options, correct_index: q.correct_index, explanation: (q.explanation || "").slice(0, 400) })));
    if (qRows.length > 0) await supabase.from("test_questions").insert(qRows);
    await supabase.from("tests").update({ day_count: 1, mode: "study_quiz", updated_at: new Date().toISOString() }).eq("id", testId);
    revalidatePath("/training");
    revalidatePath("/training/tests");
    return { error: null, id: testId, updated: true };
  }

  const settings: TestSettings = {
    title: `${department} Training Test`,
    description: `Learn the ${department} standards, then get quizzed on them.`,
    mode: "study_quiz",
    target_departments: [department],
    day_count: 1,
    pass_pct: 80,
    max_retakes: 1,
    complete_within_amount: 3,
    complete_within_unit: "days",
    rotates_monthly: false,
  };
  const res = await applyTest(settings, days, "training", department);
  revalidatePath("/training");
  return res.id ? { error: null, id: res.id, updated: false } : { error: res.error };
}

// ---- Manual editing of a saved test ----------------------------------------

export async function updateTestSettings(id: string, settings: Partial<TestSettings>): Promise<{ error: string | null }> {
  const profile = await canBuild();
  if (!profile) return { error: "Not authorized." };
  const supabase = await createClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (settings.title != null) patch.title = String(settings.title).trim().slice(0, 120);
  if (settings.description != null) patch.description = String(settings.description).slice(0, 500);
  if (settings.mode != null) patch.mode = settings.mode === "study_quiz" ? "study_quiz" : "exam";
  if (settings.target_departments != null) patch.target_departments = settings.target_departments.filter((d) => ALL_DEPARTMENTS.includes(d as Department));
  if (settings.pass_pct != null) patch.pass_pct = Math.max(1, Math.min(100, settings.pass_pct));
  if (settings.max_retakes != null) patch.max_retakes = Math.max(0, Math.min(10, settings.max_retakes));
  if (settings.complete_within_amount !== undefined) patch.complete_within_amount = settings.complete_within_amount && settings.complete_within_amount > 0 ? Math.round(settings.complete_within_amount) : null;
  if (settings.complete_within_unit != null) patch.complete_within_unit = settings.complete_within_unit === "hours" ? "hours" : "days";
  if (settings.rotates_monthly != null) patch.rotates_monthly = !!settings.rotates_monthly;
  const { error } = await supabase.from("tests").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/training/tests/${id}`);
  revalidatePath("/training/tests");
  return { error: null };
}

export async function deleteTest(id: string): Promise<void> {
  if (!(await canBuild())) return;
  const supabase = await createClient();
  await supabase.from("tests").delete().eq("id", id);
  revalidatePath("/training/tests");
}

// Duplicate a test (its settings, days, and questions) under a new title —
// handy for a monthly LTO/menu you re-run each month without rebuilding.
export async function duplicateTest(id: string, newTitle?: string): Promise<{ error: string | null; id?: string }> {
  const profile = await canBuild();
  if (!profile) return { error: "Not authorized." };
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { data: src } = await supabase
    .from("tests")
    .select("title, description, mode, target_departments, day_count, pass_pct, max_retakes, complete_within_amount, complete_within_unit, rotates_monthly, source")
    .eq("id", id)
    .maybeSingle();
  if (!src) return { error: "Test not found." };
  const s = src as {
    title: string; description: string; mode: string; target_departments: string[]; day_count: number; pass_pct: number;
    max_retakes: number; complete_within_amount: number | null; complete_within_unit: string; rotates_monthly: boolean; source: string;
  };

  const title = (newTitle?.trim() || `${s.title} (copy)`).slice(0, 120);
  const { data: copy, error } = await supabase
    .from("tests")
    .insert({
      org_id: org.id,
      title,
      description: s.description,
      mode: s.mode,
      target_departments: s.target_departments,
      day_count: s.day_count,
      pass_pct: s.pass_pct,
      max_retakes: s.max_retakes,
      complete_within_amount: s.complete_within_amount,
      complete_within_unit: s.complete_within_unit,
      rotates_monthly: s.rotates_monthly,
      source: s.source,
      created_by: profile.userId,
    })
    .select("id")
    .single();
  if (error || !copy) return { error: error?.message ?? "Couldn't duplicate the test." };
  const newId = (copy as { id: string }).id;

  const { data: days } = await supabase.from("test_days").select("day_number, title, content").eq("test_id", id);
  if (days && days.length > 0) {
    await supabase.from("test_days").insert((days as { day_number: number; title: string; content: string }[]).map((d) => ({ test_id: newId, org_id: org.id, day_number: d.day_number, title: d.title, content: d.content })));
  }
  const { data: qs } = await supabase.from("test_questions").select("day_number, sort_order, kind, prompt, options, correct_index, explanation").eq("test_id", id);
  if (qs && qs.length > 0) {
    await supabase.from("test_questions").insert((qs as { day_number: number; sort_order: number; kind: string; prompt: string; options: string[]; correct_index: number; explanation: string }[]).map((q) => ({ test_id: newId, org_id: org.id, ...q })));
  }

  revalidatePath("/training/tests");
  return { error: null, id: newId };
}

export async function setTestArchived(id: string, archived: boolean): Promise<{ error: string | null }> {
  if (!(await canBuild())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.from("tests").update({ active: !archived, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/training/tests");
  return { error: null };
}

export async function saveQuestion(q: TestQuestion & { test_id: string }): Promise<{ error: string | null }> {
  if (!(await canBuild())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const kind: QuestionKind = q.kind === "true_false" ? "true_false" : "multiple_choice";
  const options = kind === "true_false" ? ["True", "False"] : (q.options ?? []).map((o) => String(o).slice(0, 200)).filter(Boolean);
  if (kind === "multiple_choice" && options.length < 2) return { error: "Add at least two answer options." };
  if (!q.prompt?.trim()) return { error: "Add the question text." };
  const row = {
    test_id: q.test_id,
    org_id: org.id,
    day_number: Math.max(1, q.day_number || 1),
    kind,
    prompt: q.prompt.trim().slice(0, 500),
    options,
    correct_index: Math.max(0, Math.min(options.length - 1, q.correct_index || 0)),
    explanation: (q.explanation || "").slice(0, 400),
  };
  const { error } = q.id
    ? await supabase.from("test_questions").update(row).eq("id", q.id)
    : await supabase.from("test_questions").insert({ ...row, sort_order: 999 });
  if (error) return { error: error.message };
  revalidatePath(`/training/tests/${q.test_id}`);
  return { error: null };
}

export async function deleteQuestion(id: string, testId: string): Promise<void> {
  if (!(await canBuild())) return;
  const supabase = await createClient();
  await supabase.from("test_questions").delete().eq("id", id);
  revalidatePath(`/training/tests/${testId}`);
}

export async function updateDay(id: string, title: string, content: string, testId: string): Promise<void> {
  if (!(await canBuild())) return;
  const supabase = await createClient();
  await supabase.from("test_days").update({ title: title.slice(0, 120), content: content.slice(0, 4000) }).eq("id", id);
  revalidatePath(`/training/tests/${testId}`);
}

// Add a new (empty) day to a test — a fresh learning area + its own questions.
// The day lands after the current last day and bumps the test's day_count so the
// take flow knows to include it. The manager fills in the content and questions
// with the existing per-day editors.
export async function addTestDay(testId: string): Promise<{ error: string | null; dayNumber?: number }> {
  const profile = await canBuild();
  if (!profile) return { error: "Not authorized." };
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const { data: test } = await supabase.from("tests").select("day_count").eq("id", testId).maybeSingle();
  if (!test) return { error: "Test not found." };

  // day_count is the source of truth, but guard against any stray higher day rows.
  const { data: top } = await supabase.from("test_days").select("day_number").eq("test_id", testId).order("day_number", { ascending: false }).limit(1);
  const highest = Math.max((test as { day_count: number }).day_count || 0, (top?.[0] as { day_number: number } | undefined)?.day_number ?? 0);
  if (highest >= 30) return { error: "A test can have at most 30 days." };
  const next = highest + 1;

  const { error } = await supabase.from("test_days").insert({ test_id: testId, org_id: org.id, day_number: next, title: "", content: "" });
  if (error) return { error: error.message };
  await supabase.from("tests").update({ day_count: next, updated_at: new Date().toISOString() }).eq("id", testId);
  revalidatePath(`/training/tests/${testId}`);
  return { error: null, dayNumber: next };
}

// Remove a day (its study content + questions) and close the gap so the days stay
// 1..N with no holes. Won't remove the last remaining day.
export async function deleteTestDay(testId: string, dayNumber: number): Promise<{ error: string | null }> {
  if (!(await canBuild())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { data: test } = await supabase.from("tests").select("day_count").eq("id", testId).maybeSingle();
  if (!test) return { error: "Test not found." };
  const dayCount = (test as { day_count: number }).day_count || 1;
  if (dayCount <= 1) return { error: "A test needs at least one day." };

  await supabase.from("test_questions").delete().eq("test_id", testId).eq("day_number", dayNumber);
  await supabase.from("test_days").delete().eq("test_id", testId).eq("day_number", dayNumber);

  // Shift every later day (and its questions) down by one to close the gap.
  const { data: laterDays } = await supabase.from("test_days").select("id, day_number").eq("test_id", testId).gt("day_number", dayNumber).order("day_number");
  for (const d of (laterDays ?? []) as { id: string; day_number: number }[]) {
    await supabase.from("test_days").update({ day_number: d.day_number - 1 }).eq("id", d.id);
  }
  const { data: laterQs } = await supabase.from("test_questions").select("id, day_number").eq("test_id", testId).gt("day_number", dayNumber);
  for (const q of (laterQs ?? []) as { id: string; day_number: number }[]) {
    await supabase.from("test_questions").update({ day_number: q.day_number - 1 }).eq("id", q.id);
  }

  await supabase.from("tests").update({ day_count: dayCount - 1, updated_at: new Date().toISOString() }).eq("id", testId);
  revalidatePath(`/training/tests/${testId}`);
  return { error: null };
}
