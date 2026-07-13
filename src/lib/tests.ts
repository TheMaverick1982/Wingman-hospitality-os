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

export type AssignmentStatus = "assigned" | "in_progress" | "passed" | "locked";

// Decide what happens after a scored attempt: pass, allow a retake, or lock out
// (all attempts used up) — the lock is what triggers the manager alert.
export function resolveAttempt(
  pct: number,
  passPct: number,
  attemptsUsed: number,
  maxRetakes: number
): { passed: boolean; locked: boolean; retake: boolean } {
  if (pct >= passPct) return { passed: true, locked: false, retake: false };
  const totalAllowed = 1 + Math.max(0, maxRetakes); // first attempt + retakes
  if (attemptsUsed >= totalAllowed) return { passed: false, locked: true, retake: false };
  return { passed: false, locked: false, retake: true };
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
    // The food menu has many parts, so this test is broken out BY CATEGORY —
    // one day per section of the menu (plus allergens/safety) so a big menu is
    // digestible. Rename the days to match your own menu's categories.
    settings: {
      title: "Food Test",
      description: "Food knowledge across the whole menu, broken out by category — starters, salads, mains, sweets — plus allergens and safety. Rename the days to match your menu's sections.",
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
      { day_number: 1, title: "Starters, breads & shareables", content: "Your appetizers, breads, and shareable plates — key ingredients, and which to suggest for a table to share." },
      { day_number: 2, title: "Salads & greens", content: "Salads and lighter plates — dressings, proteins you can add, and the allergens that hide in them (nuts, dairy, croutons, anchovy)." },
      { day_number: 3, title: "Mains & entrées", content: "Your entrées — proteins, how they're cooked, what they're served with, and the one-line pitch for each." },
      { day_number: 4, title: "Sides, desserts & sweets", content: "Sides and anything sweet — plus which pair well with the mains, and how to drive a dessert." },
      { day_number: 5, title: "Allergens & food safety", content: "The cross-cutting must-knows for every category: the major allergens, cross-contact, and safe food handling." },
    ],
    questions: [
      q(1, "multiple_choice", "A table of four is deciding on starters. What's the best move?", ["Suggest a specific shareable and say why it's great for the table", "Tell them to each order their own", "Say they're all good", "Wait for them to decide"], 0),
      q(1, "true_false", "A great starter recommendation names the dish, says why it's good, and suggests it for the table to share.", ["True", "False"], 0),
      q(2, "multiple_choice", "A guest wants a salad but is allergic to nuts. What do you do?", ["Check the dish for nuts and cross-contact, confirm with the kitchen, or offer a safe swap", "Just pick off any visible nuts", "Tell them it's probably fine", "Recommend they order something else without checking"], 0),
      q(2, "true_false", "Dressings can carry common allergens like dairy, egg, or anchovy, so you should know what's in each.", ["True", "False"], 0),
      q(3, "multiple_choice", "A guest asks how the steak is prepared. The best answer:", ["Describe the cut, how it's cooked, and what it's served with", "Say 'it's really good'", "Go ask the kitchen every time", "Guess"], 0),
      q(3, "true_false", "You should be able to describe any main in one confident sentence, no notes.", ["True", "False"], 0),
      q(4, "multiple_choice", "What's the best way to drive a dessert?", ["Name a specific dessert and suggest sharing it", "Ask 'any dessert?' flatly", "Skip it if they seem full", "Just bring the check"], 0),
      q(5, "multiple_choice", "Which is one of the most common major food allergens?", ["Tree nuts", "Basil", "Olive oil", "Black pepper"], 0),
      q(5, "multiple_choice", "The temperature 'danger zone' where bacteria grow fastest is roughly:", ["40°F–140°F", "0°F–32°F", "150°F–200°F", "-10°F–20°F"], 0),
      q(5, "true_false", "For a serious allergy, flag it to the kitchen and confirm the dish is safe before it's served.", ["True", "False"], 0),
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
  {
    // A back-of-house recipe/method exam. Its power is realized when the owner
    // rebuilds it from their OWN menu + recipes via "Build with AI" — paste the
    // full menu with recipes and it writes ingredient/method questions per dish.
    key: "kitchen",
    settings: {
      title: "Kitchen Test",
      description: "Back-of-house recipe knowledge — ingredients in every dish, how each is made, prep specs, and food safety. Rebuild it from your own menu + recipes (Build with AI) to quiz on your exact dishes.",
      mode: "exam",
      target_departments: ["Chef", "Line Cook"],
      day_count: 5,
      pass_pct: 85,
      max_retakes: 1,
      complete_within_amount: 5,
      complete_within_unit: "days",
      rotates_monthly: false,
    },
    days: [
      { day_number: 1, title: "Mise en place & prep", content: "Every prep item — what goes in it, the spec, and par levels. Replace with your own prep list." },
      { day_number: 2, title: "Building the dishes", content: "How each dish on the line is built, step by step, in order. Paste your recipes here." },
      { day_number: 3, title: "Sauces, components & recipes", content: "The sauces and sub-recipes that go into the dishes — ratios and method." },
      { day_number: 4, title: "Plating & consistency specs", content: "The plating standard for each dish so every ticket looks the same." },
      { day_number: 5, title: "Allergens, cross-contact & safety", content: "Which dishes carry which allergens, cross-contact prevention by station, and safe temps." },
    ],
    questions: [
      q(1, "true_false", "You should know every prep item's recipe and par level without checking a sheet mid-service.", ["True", "False"], 0),
      q(1, "multiple_choice", "Mise en place matters most because:", ["Everything is prepped and in place so the line stays consistent and fast under pressure", "It looks organized for the health inspector", "It's only needed on busy nights", "It saves on ingredients"], 0),
      q(2, "multiple_choice", "You're firing a dish you're unsure how to build. The right move is:", ["Check the recipe/spec before you fire it, or ask the chef — never guess", "Plate it how you think it goes", "Skip a component to save time", "Send it and see if it comes back"], 0),
      q(2, "true_false", "Dishes should be built in the same order and method every time so they're consistent.", ["True", "False"], 0),
      q(3, "multiple_choice", "A house sauce is a component in several dishes. Why does its recipe matter so much?", ["An off sauce throws off every dish it's in, so the ratio and method must be exact", "Sauces don't really affect the dish", "Only the chef needs to know it", "It's fine to eyeball it"], 0),
      q(4, "true_false", "Plating to the spec matters because the guest should get the same dish on every ticket.", ["True", "False"], 0),
      q(5, "multiple_choice", "A dish is being fired for a guest with a nut allergy. You should:", ["Confirm the dish and its components are nut-free and prevent cross-contact, or flag the chef", "Wipe the plate and send it", "Assume it's fine if there are no visible nuts", "Leave it to the server"], 0),
      q(5, "multiple_choice", "Safe cold-holding for raw proteins is roughly:", ["At or below 40°F", "Around 70°F", "50–60°F", "Whatever the walk-in is set to"], 0),
    ],
  },
  {
    // A monthly limited-time-offer / seasonal-menu template. It's a
    // learn-then-quiz set to rotate monthly and go to ALL staff — the owner just
    // rebuilds it each month from the new menu (Build with AI) and re-sends.
    key: "lto",
    settings: {
      title: "This Month's Menu / LTO",
      description: "Learn-then-quiz for a new limited-time or seasonal menu. Preset to all staff and set to rotate monthly — each month, rebuild it from the new menu with Build with AI and send it to everyone so the whole team knows the new items.",
      mode: "study_quiz",
      target_departments: [],
      day_count: 1,
      pass_pct: 80,
      max_retakes: 2,
      complete_within_amount: 3,
      complete_within_unit: "days",
      rotates_monthly: true,
    },
    days: [
      {
        day_number: 1,
        title: "This month's new items",
        content:
          "Replace this with the month's new/limited-time items. For each one, include: the name, what's in it, how it's made or served, any allergens, the price, and a one-line pitch for recommending it. Paste your new menu here (or use Build with AI to generate it from the menu), and the team studies it before the quiz below.",
      },
    ],
    questions: [
      q(1, "true_false", "You should be able to describe each new item — what's in it and why it's worth ordering — before it goes on the floor.", ["True", "False"], 0),
      q(1, "multiple_choice", "A guest asks about a new limited-time item you haven't memorized yet. Best move:", ["Know it cold from this month's study — describe it confidently and suggest it", "Say 'I'm not sure, it's new'", "Point them to the menu and walk away", "Recommend something else instead"], 0),
      q(1, "multiple_choice", "Why do we quiz the whole team on the new menu each month?", ["So every guest gets the same confident, accurate description of the new items", "To make people study on their own time", "It's only for new hires", "No real reason"], 0),
      q(1, "true_false", "Any allergens in the new items should be known and flagged the same way as the core menu.", ["True", "False"], 0),
    ],
  },
];
