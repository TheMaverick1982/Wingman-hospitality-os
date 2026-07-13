// Lightweight UI internationalization. Pure module (safe to import from server
// or client components). Owner-authored *content* (test questions, checklist
// items, menu) is translated separately via AI; this covers the fixed app
// chrome on staff-facing surfaces.

export type Lang = "en" | "es";

export const DEFAULT_LANG: Lang = "en";

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "es", label: "Spanish", native: "Español" },
];

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "es";
}

export function normalizeLang(v: unknown): Lang {
  return isLang(v) ? v : DEFAULT_LANG;
}

type Entry = Record<Lang, string>;

// Fixed UI strings. Add sparingly and keep both languages in lockstep.
const STRINGS: Record<string, Entry> = {
  // Language picker / toggle
  "lang.choose.title": { en: "Choose your language", es: "Elige tu idioma" },
  "lang.choose.sub": {
    en: "Pick the language you’d like to use. You can change it anytime from the top bar.",
    es: "Elige el idioma que quieras usar. Puedes cambiarlo cuando quieras desde la barra superior.",
  },
  "lang.continue": { en: "Continue", es: "Continuar" },
  "lang.label": { en: "Language", es: "Idioma" },

  // Test-taking flow
  "test.dayOf": { en: "Day {n} of {count}", es: "Día {n} de {count}" },
  "test.pass": { en: "Pass {pct}%", es: "Aprobar {pct}%" },
  "test.attemptOf": { en: "Attempt {n} of {total}", es: "Intento {n} de {total}" },
  "test.submitScore": { en: "Submit & score", es: "Enviar y calificar" },
  "test.finishDay": { en: "Finish Day {n}", es: "Terminar el Día {n}" },
  "test.submitting": { en: "Submitting…", es: "Enviando…" },
  "test.answerEvery": { en: "Answer every question to continue.", es: "Responde todas las preguntas para continuar." },
  "test.noQuestions": { en: "No questions on this day.", es: "No hay preguntas para este día." },
  "test.youPassed": { en: "You passed {title}", es: "Aprobaste {title}" },
  "test.score": { en: "Score", es: "Puntaje" },
  "test.passMark": { en: "pass mark {pct}%", es: "nota mínima {pct}%" },
  "test.locked.title": { en: "This test is locked", es: "Esta prueba está bloqueada" },
  "test.locked.body": {
    en: "You’ve used all your attempts (last score {pct}%). Your manager has been notified — they’ll coach you and unlock a retest.",
    es: "Usaste todos tus intentos (último puntaje {pct}%). Se avisó a tu gerente — te dará apoyo y desbloqueará una nueva prueba.",
  },
  "test.passed.title": { en: "Passed! {pct}%", es: "¡Aprobaste! {pct}%" },
  "test.passed.body": { en: "Nice work — you cleared the {pct}% mark.", es: "¡Buen trabajo! Superaste el {pct}%." },
  "test.failLocked.title": { en: "Not passed — {pct}%", es: "No aprobaste — {pct}%" },
  "test.failLocked.body": {
    en: "That was your last attempt, so the test is now locked. Your manager has been notified to coach you and unlock a retest.",
    es: "Ese fue tu último intento, así que la prueba quedó bloqueada. Se avisó a tu gerente para apoyarte y desbloquear una nueva prueba.",
  },
  "test.fail.title": { en: "Not quite — {pct}%", es: "Casi — {pct}%" },
  "test.fail.body": { en: "You need {pct}%. Give it another go when you’re ready.", es: "Necesitas {pct}%. Inténtalo de nuevo cuando estés listo." },
  "test.retake": { en: "Retake", es: "Reintentar" },
  "test.dayDone.title": { en: "Day {n} done — nice work", es: "Día {n} completado — ¡buen trabajo!" },
  "test.dayDone.body": {
    en: "If you’re feeling good about it, keep going to Day {next}. No rush, though — your progress is saved, so you can come back and finish anytime.",
    es: "Si te sientes bien, sigue al Día {next}. Sin apuro — tu progreso se guarda, así que puedes volver y terminar cuando quieras.",
  },
  "test.keepGoing": { en: "Keep going to Day {next}", es: "Seguir al Día {next}" },
  "test.finishLater": { en: "I’ll finish later", es: "Termino después" },

  // Staff checklist cards (pre-shift + FOH loyalty)
  "checklist.preshift.title": { en: "Your pre-shift checklist", es: "Tu lista de antes del turno" },
  "checklist.preshift.sub": { en: "Check off what you’ve done, then submit so your manager can see it.", es: "Marca lo que hiciste y envíalo para que tu gerente lo vea." },
  "checklist.preshift.done": { en: "Your pre-shift checklist is done for today", es: "Tu lista de antes del turno está lista por hoy" },
  "checklist.loyalty.title": { en: "Your loyalty checklist", es: "Tu lista de lealtad" },
  "checklist.loyalty.sub": { en: "Take care of every loyalty member on the floor — check off what you did this shift.", es: "Atiende a cada miembro del programa de lealtad — marca lo que hiciste en este turno." },
  "checklist.loyalty.done": { en: "Your loyalty checklist is done for today", es: "Tu lista de lealtad está lista por hoy" },
  "checklist.submit": { en: "Submit checklist", es: "Enviar lista" },
  "checklist.submitting": { en: "Submitting…", es: "Enviando…" },
  "checklist.cancel": { en: "Cancel", es: "Cancelar" },
  "checklist.update": { en: "Update", es: "Actualizar" },
  "checklist.completedAt": { en: "Completed at {time}", es: "Completado a las {time}" },
  "checklist.completed": { en: "Completed", es: "Completado" },
};

export type StringKey = keyof typeof STRINGS;

export function t(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  const entry = STRINGS[key];
  let s = entry ? entry[lang] ?? entry.en : String(key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
