// Configuration for the public job-application form. Owners can relabel, enable/
// disable, and require each built-in field, and add their own custom questions.
// The config lives on organizations.application_form_config; each application
// stores the answers to any custom questions in job_applications.custom_answers.

export type BuiltinKey =
  | "email"
  | "phone"
  | "department"
  | "location"
  | "availability"
  | "preferredVisit"
  | "message"
  | "resume";

export type BuiltinSetting = { enabled: boolean; required: boolean; label?: string };

export type CustomFieldType = "short_text" | "long_text" | "dropdown" | "yes_no" | "number";

export type CustomField = {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[]; // dropdown choices
};

export type ApplicationFormConfig = {
  headline?: string;
  intro?: string;
  builtins: Partial<Record<BuiltinKey, BuiltinSetting>>;
  custom: CustomField[];
};

// A stored answer keeps the label at submit time, so the applicant view is stable
// even if the owner later renames or removes the question.
export type CustomAnswer = { id: string; label: string; value: string };

export const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Paragraph" },
  { value: "dropdown", label: "Dropdown" },
  { value: "yes_no", label: "Yes / No" },
  { value: "number", label: "Number" },
];

// Built-in fields in display order, with their default labels. "name" is always
// present and required (it's the applicant's identity), so it isn't listed here.
export const BUILTIN_FIELDS: { key: BuiltinKey; defaultLabel: string; note?: string }[] = [
  { key: "email", defaultLabel: "Email" },
  { key: "phone", defaultLabel: "Phone" },
  { key: "department", defaultLabel: "Role you want" },
  { key: "location", defaultLabel: "Location", note: "Only appears when you have more than one location." },
  { key: "availability", defaultLabel: "Availability" },
  { key: "preferredVisit", defaultLabel: "When could you come in?" },
  { key: "message", defaultLabel: "Anything else?" },
  { key: "resume", defaultLabel: "Résumé" },
];

const BUILTIN_KEYS = new Set<string>(BUILTIN_FIELDS.map((f) => f.key));
const TYPE_SET = new Set<string>(CUSTOM_FIELD_TYPES.map((t) => t.value));

export function defaultFormConfig(): ApplicationFormConfig {
  return { builtins: {}, custom: [] };
}

// The effective settings for a built-in field: on unless disabled, optional unless
// required, with the owner's label or the default.
export function builtinSetting(config: ApplicationFormConfig | null | undefined, key: BuiltinKey): { enabled: boolean; required: boolean; label: string } {
  const def = BUILTIN_FIELDS.find((f) => f.key === key)!;
  const s = config?.builtins?.[key];
  const label = (s?.label ?? "").trim() || def.defaultLabel;
  return { enabled: s?.enabled ?? true, required: s?.required ?? false, label };
}

// Coerce arbitrary stored/incoming JSON into a safe config we can trust.
export function normalizeFormConfig(raw: unknown): ApplicationFormConfig {
  const r = (raw ?? {}) as Partial<ApplicationFormConfig>;
  const builtins: Partial<Record<BuiltinKey, BuiltinSetting>> = {};
  if (r.builtins && typeof r.builtins === "object") {
    for (const [k, v] of Object.entries(r.builtins)) {
      if (!BUILTIN_KEYS.has(k) || !v || typeof v !== "object") continue;
      const s = v as BuiltinSetting;
      builtins[k as BuiltinKey] = {
        enabled: s.enabled !== false,
        required: Boolean(s.required),
        label: typeof s.label === "string" ? s.label.slice(0, 80) : undefined,
      };
    }
  }
  const custom: CustomField[] = Array.isArray(r.custom)
    ? r.custom
        .filter((f): f is CustomField => Boolean(f) && typeof f === "object")
        .slice(0, 30)
        .map((f, i) => {
          const type = (TYPE_SET.has(f.type) ? f.type : "short_text") as CustomFieldType;
          const options =
            type === "dropdown"
              ? (Array.isArray(f.options) ? f.options : []).map((o) => String(o).slice(0, 100)).filter(Boolean).slice(0, 20)
              : undefined;
          return {
            id: (typeof f.id === "string" && f.id) ? f.id.slice(0, 40) : `f${i}`,
            label: String(f.label ?? "").slice(0, 120),
            type,
            required: Boolean(f.required),
            options,
          };
        })
        .filter((f) => f.label.trim())
    : [];
  const headline = typeof r.headline === "string" ? r.headline.slice(0, 120) : undefined;
  const intro = typeof r.intro === "string" ? r.intro.slice(0, 300) : undefined;
  return { headline, intro, builtins, custom };
}
