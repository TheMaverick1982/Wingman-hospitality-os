// Types + constants for the Training testing/exam feature. Pure + client-safe.

export type TestMode = "exam" | "study_quiz";
export type QuestionKind = "multiple_choice" | "true_false";

export type TestQuestion = {
  id?: string;
  day_number: number;
  sort_order?: number;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

export type TestDay = {
  id?: string;
  day_number: number;
  title: string;
  content: string;
};

export type TestSettings = {
  title: string;
  description: string;
  mode: TestMode;
  target_departments: string[]; // empty = all roles
  day_count: number;
  pass_pct: number;
  max_retakes: number;
  complete_within_amount: number | null;
  complete_within_unit: "hours" | "days";
  rotates_monthly: boolean;
};

export type TestFull = TestSettings & {
  id: string;
  source: string;
  active: boolean;
  days: TestDay[];
  questions: TestQuestion[];
};

export const TEST_DEFAULTS = {
  pass_pct: 80,
  max_retakes: 1,
  day_count: 1,
  complete_within_amount: 7 as number | null,
  complete_within_unit: "days" as "hours" | "days",
} as const;

export const MODE_LABEL: Record<TestMode, string> = {
  exam: "Exam (questions only)",
  study_quiz: "Learn, then quiz (teach first — great for LTO / menu)",
};

// Score a set of answers (index the person picked per question id) against the
// questions. Pure so it can be unit-tested and reused on the server.
export function scoreTest(
  questions: { id?: string; correct_index: number }[],
  answers: Record<string, number>
): { correct: number; total: number; pct: number } {
  const total = questions.length;
  let correct = 0;
  for (const q of questions) {
    if (q.id && answers[q.id] === q.correct_index) correct++;
  }
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, pct };
}

export function completionWindowLabel(amount: number | null, unit: "hours" | "days"): string {
  if (!amount) return "No deadline";
  return `${amount} ${unit === "hours" ? "hour" : "day"}${amount === 1 ? "" : "s"} to complete`;
}

// ---------------------------------------------------------------------------
// Starter templates the owner can drop in and then tailor — the Food Test and
// the Bartender Test called for as initial examples.
// ---------------------------------------------------------------------------

export type ExampleTest = { key: string; settings: TestSettings; days: TestDay[]; questions: TestQuestion[] };

const q = (day: number, kind: QuestionKind, prompt: string, options: string[], correct: number, explanation = ""): TestQuestion => ({
  day_number: day,
  kind,
  prompt,
  options,
  correct_index: correct,
  explanation,
});

export const EXAMPLE_TESTS: ExampleTest[] = [
  {
    key: "food",
    settings: {
      title: "Food Test",
      description: "Core food knowledge every kitchen and floor team member should know — ingredients, allergens, prep standards, and food safety.",
      mode: "exam",
      target_departments: ["Chef", "Server"],
      day_count: 5,
      pass_pct: 80,
      max_retakes: 1,
      complete_within_amount: 5,
      complete_within_unit: "days",
      rotates_monthly: false,
    },
    days: [
      { day_number: 1, title: "Menu & ingredients", content: "Know every dish on the menu: what's in it, how it's made, and what makes it worth recommending." },
      { day_number: 2, title: "Allergens & dietary needs", content: "The big allergens, cross-contact, and how we handle a guest with a dietary restriction." },
      { day_number: 3, title: "Food safety & temperatures", content: "Safe holding temps, the danger zone, and cross-contamination basics." },
      { day_number: 4, title: "Prep & plating standards", content: "Our prep specs and plating standard for consistency across every ticket." },
      { day_number: 5, title: "Putting it together", content: "Tie it all together — describe a dish, flag an allergen, and hold a standard." },
    ],
    questions: [
      q(1, "multiple_choice", "A guest asks what's in the house Caesar dressing. Which is a core ingredient they should know to mention for allergens?", ["Anchovies", "Peanuts", "Soy sauce", "Sesame oil"], 0, "Traditional Caesar contains anchovies (fish) — an allergen worth surfacing."),
      q(1, "true_false", "You should be able to recommend a dish by naming it, why it's good, and a reason to order it now.", ["True", "False"], 0),
      q(2, "multiple_choice", "Which is one of the most common major food allergens?", ["Tree nuts", "Basil", "Olive oil", "Black pepper"], 0),
      q(2, "true_false", "Cross-contact means an allergen was transferred to a food that doesn't list it as an ingredient.", ["True", "False"], 0),
      q(3, "multiple_choice", "The temperature 'danger zone' where bacteria grow fastest is roughly:", ["40°F–140°F", "0°F–32°F", "150°F–200°F", "-10°F–20°F"], 0),
      q(3, "true_false", "Raw proteins should be stored below ready-to-eat foods in the walk-in.", ["True", "False"], 0),
      q(4, "true_false", "Plating to a consistent standard matters because the guest experience should be the same on every ticket.", ["True", "False"], 0),
      q(5, "multiple_choice", "A guest says they have a shellfish allergy. What do you do first?", ["Flag it to the kitchen and confirm the dish is safe or offer an alternative", "Tell them most dishes are probably fine", "Remove the garnish and serve it", "Ask another server"], 0),
    ],
  },
  {
    key: "bartender",
    settings: {
      title: "Bartender Test",
      description: "Bar fundamentals — core cocktail specs, pour standards, responsible service, and speed-with-quality behind the bar.",
      mode: "exam",
      target_departments: ["Bartender"],
      day_count: 3,
      pass_pct: 80,
      max_retakes: 1,
      complete_within_amount: 3,
      complete_within_unit: "days",
      rotates_monthly: false,
    },
    days: [
      { day_number: 1, title: "Core cocktails & specs", content: "The house cocktail list and the classics — build, glass, and garnish for each." },
      { day_number: 2, title: "Pours, standards & consistency", content: "Our pour standards, jiggering, and why consistency protects both cost and the guest." },
      { day_number: 3, title: "Responsible service", content: "Reading a guest, cutting off responsibly, and checking ID." },
    ],
    questions: [
      q(1, "multiple_choice", "A classic Margarita is built from:", ["Tequila, lime, orange liqueur", "Vodka, cranberry, lime", "Gin, vermouth, olive", "Rum, mint, sugar, lime"], 0),
      q(1, "true_false", "Garnish and glassware are part of the spec — a drink isn't 'right' without them.", ["True", "False"], 0),
      q(2, "multiple_choice", "Why do we free-pour to a count or jigger to a standard?", ["Consistency and cost control", "To pour faster only", "It looks impressive", "It's not important"], 0),
      q(2, "true_false", "An over-poured cocktail costs more AND makes the next one taste 'weak' by comparison.", ["True", "False"], 0),
      q(3, "multiple_choice", "A guest is showing clear signs of intoxication. The right move is to:", ["Stop alcohol service, offer water/food, arrange a safe ride", "Serve one more but water it down", "Ignore it if they're not driving", "Ask them to leave immediately with no help"], 0),
      q(3, "true_false", "You should check ID for anyone who appears under the legal age, every time.", ["True", "False"], 0),
    ],
  },
];
