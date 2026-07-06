// Placeholder until we can generate real types from the live Supabase schema:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
// Keeping this loose (rather than `unknown`) so query builders still type-check
// during development; tighten it up once the schema is live.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
