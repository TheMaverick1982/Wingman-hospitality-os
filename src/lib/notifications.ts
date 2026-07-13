// The catalog of automatic emails Wingman sends for an account, and the account's
// on/off preference for each. Preferences live on organizations.notification_settings
// (a jsonb map of key -> boolean). A missing key means the default (on), so turning
// something OFF is what gets stored; everything defaults to sending.

export type NotificationKey =
  | "new_application"
  | "interview_reminders"
  | "test_locked"
  | "test_overdue"
  | "test_reminders_staff";

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
];

export type NotificationSettings = Partial<Record<NotificationKey, boolean>> | null | undefined;

// A notification is on unless it's been explicitly turned off (set to false).
export function isNotificationEnabled(settings: NotificationSettings, key: NotificationKey): boolean {
  return settings?.[key] !== false;
}

export const NOTIFICATION_GROUPS: string[] = [...new Set(NOTIFICATION_TYPES.map((n) => n.group))];
