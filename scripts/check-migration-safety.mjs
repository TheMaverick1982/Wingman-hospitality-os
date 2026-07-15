#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Data-safety guard for launches. Runs before every build (prebuild) so a
// catastrophic, client-data-destroying migration can never ship silently.
//
//   * FAILS the build on catastrophic statements: DROP TABLE, TRUNCATE,
//     DROP DATABASE, DROP SCHEMA. These wipe client data wholesale and must
//     never run against production without a deliberate, backed-up decision.
//   * WARNS (does not fail) on narrower data-losing statements: DROP COLUMN and
//     unscoped-looking DELETEs — surfaced for review, not blocked, because the
//     history contains legitimate, intentional ones inside functions.
//
// Escape hatch: if a catastrophic statement is genuinely required, annotate that
// line with `-- safety-ok: <reason>`. That forces a conscious, reviewable choice
// instead of an accidental wipe. Never add the annotation to dodge the check —
// prefer a soft delete (deleted_at) so the owner can always recover from Trash.
// -----------------------------------------------------------------------------
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

const CATASTROPHIC = /\b(drop\s+table|truncate\b|drop\s+database|drop\s+schema)\b/i;
const RISKY = /\b(drop\s+column|delete\s+from)\b/i;

let files = [];
try {
  files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
} catch {
  console.log("[migration-safety] no supabase/migrations directory — skipping.");
  process.exit(0);
}

const blocking = [];
const warnings = [];

for (const file of files) {
  const lines = readFileSync(join(migrationsDir, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    const code = line.split("--")[0]; // ignore comment-only text
    const acknowledged = /--\s*safety-ok/i.test(line);
    if (CATASTROPHIC.test(code) && !acknowledged) {
      blocking.push(`${file}:${i + 1}  ${line.trim()}`);
    } else if (RISKY.test(code)) {
      warnings.push(`${file}:${i + 1}  ${line.trim()}`);
    }
  });
}

if (warnings.length) {
  console.log(`\n[migration-safety] ${warnings.length} data-losing statement(s) to be aware of (not blocking):`);
  for (const w of warnings) console.log("  · " + w);
}

if (blocking.length) {
  console.error(`\n[migration-safety] ✖ BLOCKED — ${blocking.length} catastrophic statement(s) that would destroy client data:`);
  for (const b of blocking) console.error("  ✖ " + b);
  console.error(
    "\nThese wipe client data. If truly intended, back up first and annotate the line with `-- safety-ok: <reason>`.\n" +
      "Otherwise use a soft delete (deleted_at) so owners can recover from Trash. Aborting build.\n",
  );
  process.exit(1);
}

console.log(`[migration-safety] ✓ ${files.length} migrations checked — no catastrophic data-loss statements.`);
process.exit(0);
