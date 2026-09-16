// The catalog of automatic emails Wingman sends for an account, and the account's
// on/off preference for each. Preferences live on organizations.notification_settings
// (a jsonb map of key -> boolean). A missing key means the default (on), so turning
// something OFF is what gets stored; everything defaults to sending.

export type NotificationKey =
  | "new_application"
  | "interview_reminders"
  | "test_locked"
  | "test_overdue"
  | "test_reminders_staff"
  | "monthly_training"
  | "partner_followups"
  | "partner_monthly_report"
  | "staff_question"
  | "shift_feedback"
  | "manager_channel"
  | "culture_wins"
  | "culture_focus";

export type NotificationType = {
  key: NotificationKey;
  group: string;
  label: string;
  description: string;
  // Who actually receives this email — shown so managers know what a toggle controls.
  audience: string;
};

export const NOTIFICATION_TYPES: NotificationType[] = [
  {
    key: "new_application",
    group: "Hiring",
    label: "New job application",
    description: "When someone submits your online application form, email the location (and any CC addresses) that a new applicant came in.",
    audience: "Location email + application CCs",
  },
  {
    key: "interview_reminders",
    group: "Hiring",
    label: "Interview day reminders",
    description: "A morning digest to each location that has an interview scheduled that day, so nobody forgets a booked interview.",
    audience: "Location email",
  },
  {
    key: "staff_question",
    group: "Team",
    label: "Staff question escalated",
    description: "When a team member asks the Ask Wingman assistant a question it can't answer and escalates it, email the location's manager so they can reply.",
    audience: "Location email",
  },
  {
    key: "shift_feedback",
    group: "Team",
    label: "Post-shift feedback",
    description: "When a team member leaves an end-of-shift reflection (what went well, what to improve, anything guests said), email the location so managers can read and act on it. Managers are always pushed in-app; this toggle controls the email copy.",
    audience: "Location email",
  },
  {
    key: "manager_channel",
    group: "Team",
    label: "Manager updates posts",
    description: "When someone posts a new message (not a reply) in Manager updates, email the other managers so nothing important is missed. Managers are always pushed in-app; this toggle controls the email copy.",
    audience: "Managers",
  },
  {
    key: "culture_wins",
    group: "Culture",
    label: "Wins & recognition (push to the team)",
    description: "When anyone shares a win or recognizes a teammate — including a guest review turned into a shout-out — send a phone notification to the whole team who have the app, so recognition is felt in the moment. This controls that in-app push (there's no email for it).",
    audience: "Everyone with the app",
  },
  {
    key: "culture_focus",
    group: "Culture",
    label: "Weekly focus & experiment (push to the team)",
    description: "When a manager sets this week's pre-shift focus or the weekly experiment, notify the whole team who have the app so everyone starts the week pointed at the same thing. This controls that in-app push (there's no email for it).",
    audience: "Everyone with the app",
  },
  {
    key: "test_overdue",
    group: "Training & tests",
    label: "Test not finished by deadline",
    description: "When a deadline passes and someone still hasn't completed an assigned test, email the manager so they can follow up.",
    audience: "Location manager",
  },
  {
    key: "test_locked",
    group: "Training & tests",
    label: "Test locked (retakes used up)",
    description: "When someone uses up all their attempts without passing, email the manager to coach them and unlock a retest.",
    audience: "Location manager",
  },
  {
    key: "test_reminders_staff",
    group: "Training & tests",
    label: "Deadline reminders to staff",
    description: "Before a test's deadline, email the employee a reminder to finish it in time (helpful on multi-day tests).",
    audience: "The staff member taking the test",
  },
  {
    key: "monthly_training",
    group: "Training & tests",
    label: "Monthly continuing-education training",
    description: "On the 1st of each month, re-assign every test marked \"Rotates monthly\" to staff as a fresh attempt, and email them a link — so ongoing hospitality training is a habit.",
    audience: "Each staff member the training targets",
  },
  {
    key: "partner_followups",
    group: "Partners",
    label: "Follow-up task reminders",
    description: "When a Partners follow-up task comes due, email the manager who scheduled it so a relationship doesn't slip.",
    audience: "The manager who created the task",
  },
  {
    key: "partner_monthly_report",
    group: "Partners",
    label: "Monthly Partners report",
    description: "On the 1st of each month, email a leadership rollup across all stores, plus each manager their store's metrics and a follow-up hit list.",
    audience: "Account owner + report email, and each location manager",
  },
];

export type NotificationSettings = Partial<Record<NotificationKey, boolean>> | null | undefined;

// Most notifications are ON by default (turning one OFF is what gets stored).
// A few are OPT-IN — off until an owner deliberately turns them on — because
// they fan out to the whole team's phones and shouldn't start buzzing everyone
// automatically. These default off: enabled only when explicitly set to true.
export const DEFAULT_OFF_KEYS: ReadonlySet<NotificationKey> = new Set<NotificationKey>([
  "culture_wins",
  "culture_focus",
]);

// A notification is on unless explicitly turned off — except the opt-in keys
// above, which are off unless explicitly turned on.
export function isNotificationEnabled(settings: NotificationSettings, key: NotificationKey): boolean {
  if (DEFAULT_OFF_KEYS.has(key)) return settings?.[key] === true;
  return settings?.[key] !== false;
}

export const NOTIFICATION_GROUPS: string[] = [...new Set(NOTIFICATION_TYPES.map((n) => n.group))];
