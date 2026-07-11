// First-name personalization for outbound email, with an inappropriate-name
// filter. If a lead types junk or something offensive as their name, we must not
// echo it back at them in an email — we fall back to a neutral greeting instead.

// Word-boundary list (matched against each token of the name).
const PROFANITY = [
  "fuck", "fucker", "fucking", "shit", "bitch", "bastard", "asshole", "arsehole",
  "cunt", "dick", "cock", "pussy", "prick", "twat", "wanker", "wank", "bollocks",
  "slut", "whore", "douche", "jackass", "dumbass", "penis", "vagina", "boobs",
  "tits", "titties", "nutsack", "jizz", "cum", "porn", "anus", "rectum",
];

// Substring list — slurs and hard terms that should never appear inside a name.
const HARD_TERMS = [
  "nigger", "nigga", "faggot", "fagg", "retard", "chink", "spic", "kike", "wetback",
  "coon", "tranny", "rape", "rapist", "hitler", "nazi", "kill yourself", "kys",
];

// Collapse common leetspeak so "f4gg0t" / "sh1t" don't slip through.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z ]/g, "");
}

export function isInappropriateName(name: string): boolean {
  const norm = normalize(name);
  if (!norm.trim()) return true;
  if (HARD_TERMS.some((t) => norm.replace(/ /g, "").includes(t.replace(/ /g, "")))) return true;
  const tokens = norm.split(/\s+/).filter(Boolean);
  const profSet = new Set(PROFANITY);
  return tokens.some((t) => profSet.has(t));
}

// The safe first name to greet someone by, or null if we shouldn't use it.
export function safeFirstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  // Reject obvious non-names: emails, URLs, links, over-long input.
  if (/[@/<>]|https?:/i.test(trimmed) || trimmed.length > 40) return null;
  if (isInappropriateName(trimmed)) return null;
  const first = trimmed.split(/\s+/)[0];
  if (!first || !/[a-zA-Z]/.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// Replace {{first_name}} / {{name}} merge fields, using a neutral fallback when
// the name is missing or filtered out.
export function personalize(text: string, name: string | null | undefined): string {
  const first = safeFirstName(name) ?? "there";
  return text.replace(/\{\{\s*(first_name|name)\s*\}\}/gi, first);
}
