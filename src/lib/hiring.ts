export type CoreValueRow = {
  title: string;
  description: string;
  hiring_question: string | null;
  hiring_green_flag: string | null;
  hiring_red_flag: string | null;
};

export function hiringGuidanceFor(value: CoreValueRow) {
  if (value.hiring_question && value.hiring_green_flag && value.hiring_red_flag) {
    return { question: value.hiring_question, green: value.hiring_green_flag, red: value.hiring_red_flag };
  }
  return {
    question: `Tell me about a specific time you showed this: "${value.title}."`,
    green: "Gives a concrete, specific story with a clear action they took.",
    red: "Speaks in generalities, no real example, or contradicts the value.",
  };
}
