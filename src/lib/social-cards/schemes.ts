// The rotating color schemes, sampled exactly from the existing Wingman posting
// system: vivid brand blue, near-black charcoal, and warm cream. Text/handle/
// accent tuned per background so contrast holds.

export type SchemeKey = "blue" | "charcoal" | "cream";

export type Scheme = {
  bg: string;
  ink: string; // primary headline / body text
  sub: string; // muted supporting line
  handle: string; // @joinwingman
  accent: string; // big stat / emphasis
  plane: string; // plane tint
  badgeBg: string; // numbered-list badge fill
  badgeInk: string; // numbered-list badge number
};

export const SCHEMES: Record<SchemeKey, Scheme> = {
  blue: {
    bg: "#0a6cff",
    ink: "#ffffff",
    sub: "rgba(255,255,255,0.74)",
    handle: "rgba(255,255,255,0.72)",
    accent: "#ffffff",
    plane: "#ffffff",
    badgeBg: "#ffffff",
    badgeInk: "#0a6cff",
  },
  charcoal: {
    bg: "#14161a",
    ink: "#ffffff",
    sub: "rgba(255,255,255,0.6)",
    handle: "rgba(255,255,255,0.5)",
    accent: "#3f83ff",
    plane: "#ffffff",
    badgeBg: "#0a6cff",
    badgeInk: "#ffffff",
  },
  cream: {
    bg: "#f5f3ec",
    ink: "#14161a",
    sub: "rgba(20,22,26,0.62)",
    handle: "rgba(20,22,26,0.45)",
    accent: "#0a6cff",
    plane: "#0a6cff",
    badgeBg: "#0a6cff",
    badgeInk: "#ffffff",
  },
};

export const SCHEME_KEYS = Object.keys(SCHEMES) as SchemeKey[];

// The card layouts. Photo-based cards are intentionally excluded — they need a
// real photograph the renderer can't produce.
export type CardType = "brand" | "stat" | "calc" | "tip";

// One card's content. Fields used depend on `type`:
//  - brand: headline
//  - stat:  stat, subhead, support?
//  - calc:  intro, number, outro
//  - tip:   title, items[]
export type CardSpec = {
  type: CardType;
  scheme: SchemeKey;
  headline?: string;
  stat?: string;
  subhead?: string;
  support?: string;
  intro?: string;
  number?: string;
  outro?: string;
  title?: string;
  items?: string[];
  handle?: string; // defaults to @joinwingman
};
