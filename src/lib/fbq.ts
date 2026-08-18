// Thin wrappers around the Meta Pixel's global fbq(). They no-op on the server
// and until the pixel script has loaded, so callers never have to guard. Use
// fbTrack for Meta's standard events (Lead, Schedule, …) and fbTrackCustom for
// our own (CalcResult).
type FbqParams = Record<string, unknown>;

function getFbq(): ((...args: unknown[]) => void) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { fbq?: (...args: unknown[]) => void };
  return typeof w.fbq === "function" ? w.fbq : null;
}

export function fbTrack(event: string, params?: FbqParams): void {
  getFbq()?.("track", event, params);
}

export function fbTrackCustom(event: string, params?: FbqParams): void {
  getFbq()?.("trackCustom", event, params);
}
