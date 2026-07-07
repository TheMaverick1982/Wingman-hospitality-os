import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

async function fetchGaMeasurementId(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("platform_settings").select("ga_measurement_id").eq("id", true).maybeSingle();
    return data?.ga_measurement_id ?? null;
  } catch {
    // A DB hiccup (or a missing service-role key in this environment)
    // should never take down every page on the site — analytics tracking
    // is not worth that trade-off.
    return null;
  }
}

// Cached for 5 minutes so the root layout isn't hitting the database (via
// the service-role client) on every single page view across the whole site.
export const getGaMeasurementId = unstable_cache(fetchGaMeasurementId, ["ga-measurement-id"], {
  revalidate: 300,
  tags: ["ga-measurement-id"],
});
