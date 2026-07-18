// Consent copy shared by the client form and the (server) action. Kept out of the
// "use server" actions file, which may only export async functions.

// The exact opt-in language shown on the form — stored verbatim with each
// submission as the consent record (A2P 10DLC). Bump the version if wording
// changes so records reflect what each person actually agreed to.
export const SMS_CONSENT_VERSION = "2026-07-18";

export const TRANSACTIONAL_CONSENT =
  "I agree to receive account and appointment text messages (booking confirmations and reminders) from Wingman (The Maverick Agency) at the number provided. Message frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help.";

export const MARKETING_CONSENT =
  "I agree to receive marketing & promotional text messages from Wingman (The Maverick Agency) at the number provided. Consent is not a condition of purchase. Message frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help.";
