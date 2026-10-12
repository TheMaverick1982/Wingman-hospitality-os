// Heuristic spam scoring for the public /contact form.
//
// The contact form has no CAPTCHA on purpose — it's a low-traffic form for real
// restaurant owners and we don't want to add friction (and Turnstile has its own
// false-positive problems with in-app browsers). That leaves the honeypot + rate
// limit as the only guards, and a wave of bots now slips past both: they skip the
// hidden honeypot field and spread across IPs to dodge the rate limit.
//
// Those bots share obvious fingerprints, though. This scorer looks for them so we
// can drop the junk without touching the form humans see:
//   • Gmail dot-trick addresses — Gmail ignores dots in the local part, so a bot
//     sprays one inbox as dozens of "addresses" by sprinkling dots.
//   • Gibberish names — a single long run of random mixed-case characters.
//   • Phone-number-as-message — a second random number dropped in the message box.
//
// Scoring is additive and deliberately conservative: no single mildly-odd trait
// crosses the threshold, so a real lead would need several independent weird
// signals to be suppressed (losing a real lead is worse than letting one spam
// email through). When the score reaches CONTACT_SPAM_THRESHOLD the submission is
// still recorded for the audit trail, but the team notification email and the CRM
// pipeline mirror are skipped.

export const CONTACT_SPAM_THRESHOLD = 3;

const VOWELS = /[aeiou]/gi;
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export type ContactSpamInput = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

export type ContactSpamResult = { score: number; reasons: string[]; isSpam: boolean };

// Count transitions between a lowercase and an uppercase letter within a token.
// Real names have very few ("McDonald" = 2); random bot strings have many.
function caseFlips(s: string): number {
  let flips = 0;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1];
    const b = s[i];
    if (/[a-z]/.test(a) && /[A-Z]/.test(b)) flips++;
    else if (/[A-Z]/.test(a) && /[a-z]/.test(b)) flips++;
  }
  return flips;
}

// A single long token (no spaces) that is either case-scrambled or almost
// vowel-free reads as machine-generated. Real names have a space or normal
// vowel structure; this leaves short/ordinary single names alone.
function looksLikeGibberish(nameRaw: string): boolean {
  const name = nameRaw.trim();
  if (/\s/.test(name)) return false;
  const letters = name.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 12) return false;
  const vowels = (letters.match(VOWELS) || []).length;
  const vowelRatio = vowels / letters.length;
  return caseFlips(name) >= 5 || vowelRatio < 0.25;
}

// A name with no vowels at all (and some length) is not a real name.
function hasNoVowels(nameRaw: string): boolean {
  const letters = nameRaw.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 8 && (letters.match(VOWELS) || []).length === 0;
}

// Dots in a Gmail local part (before any +tag). Gmail canonicalizes them away,
// so a high count is a near-certain sign of inbox-spraying.
function gmailDotCount(email: string): number {
  const at = email.lastIndexOf("@");
  if (at < 0) return 0;
  const domain = email.slice(at + 1).toLowerCase();
  if (!GMAIL_DOMAINS.has(domain)) return 0;
  const local = email.slice(0, at).split("+")[0];
  return (local.match(/\./g) || []).length;
}

// Message present but containing no letters at all (just digits/symbols) — the
// bots drop a second phone number into the "how can we help" box.
function messageHasNoLetters(message: string): boolean {
  const m = message.trim();
  return m.length > 0 && !/[a-zA-Z]/.test(m);
}

export function scoreContactSpam(input: ContactSpamInput): ContactSpamResult {
  const name = String(input.name || "");
  const email = String(input.email || "").toLowerCase();
  const message = String(input.message || "");
  const reasons: string[] = [];
  let score = 0;

  const dots = gmailDotCount(email);
  if (dots >= 6) {
    score += 3;
    reasons.push(`gmail-dots:${dots}`);
  } else if (dots >= 3) {
    score += 1;
    reasons.push(`gmail-dots:${dots}`);
  }

  if (looksLikeGibberish(name)) {
    score += 2;
    reasons.push("gibberish-name");
  }

  if (hasNoVowels(name)) {
    score += 2;
    reasons.push("no-vowel-name");
  }

  if (messageHasNoLetters(message)) {
    score += 1;
    reasons.push("non-text-message");
  }

  return { score, reasons, isSpam: score >= CONTACT_SPAM_THRESHOLD };
}
