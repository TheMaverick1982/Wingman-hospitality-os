// Shared constants for the Health (error monitor) surface. Kept out of actions.ts
// because a "use server" module may only export async functions.

// Page size for the resolved-errors history ("Load more"). Open bugs aren't
// paginated — they're self-limiting because you resolve them.
export const RESOLVED_PAGE_SIZE = 50;

export const ERROR_COLS =
  "id, fingerprint, message, stack, route, source, org_id, user_email, count, resolved, first_seen, last_seen";
