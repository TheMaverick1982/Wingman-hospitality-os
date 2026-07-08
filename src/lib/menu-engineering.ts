// Menu engineering: rank items by the two things that actually decide a
// menu's profit -- how much money each item makes (contribution margin, in
// dollars, not percent) and how well it sells -- then sort them into the
// four classic quadrants with a plain-English action for each. Kept simple
// on purpose: popularity is a High/Med/Low pick, not a units-sold export, so
// an operator can actually fill it in.

export type MenuItemRow = {
  id: string;
  name: string;
  price: number;
  food_cost: number;
  popularity: number; // 1 = Low, 2 = Medium, 3 = High
};

export type Quadrant = "star" | "plowhorse" | "puzzle" | "dog";

export const QUADRANT_META: Record<Quadrant, { label: string; tone: string; dot: string; action: string }> = {
  star: {
    label: "Star",
    tone: "text-[#15803D] bg-[#E7F6EC]",
    dot: "bg-[#16A34A]",
    action: "Feature it — box it, put it in a menu sweet spot, protect the recipe and the plate.",
  },
  plowhorse: {
    label: "Plowhorse",
    tone: "text-[#B45309] bg-[#FDF3E1]",
    dot: "bg-[#D97706]",
    action: "Popular but thin — nudge the price up, trim portion cost, or bundle it to lift the margin.",
  },
  puzzle: {
    label: "Puzzle",
    tone: "text-brick-dark bg-brick-tint",
    dot: "bg-brick",
    action: "Profitable but overlooked — reposition it, rename it, or have staff recommend it by name.",
  },
  dog: {
    label: "Dog",
    tone: "text-[#B91C1C] bg-danger-tint",
    dot: "bg-[#DC2626]",
    action: "Low profit and low pull — rework the recipe, re-cost it, or cut it from the menu.",
  },
};

export type ClassifiedMenuItem = MenuItemRow & {
  margin: number;
  marginPct: number;
  quadrant: Quadrant;
};

export const POPULARITY_OPTIONS = [
  { value: 3, label: "High — a top seller" },
  { value: 2, label: "Medium — steady" },
  { value: 1, label: "Low — rarely ordered" },
] as const;

function margin(item: MenuItemRow): number {
  return item.price - item.food_cost;
}

/**
 * Classifies each item against the menu's own averages: an item is a "high
 * margin" item if it makes more than the average dollar margin, and "high
 * popularity" if it sells at or above the average of what's on the menu.
 */
export function classifyMenu(items: MenuItemRow[]): {
  items: ClassifiedMenuItem[];
  counts: Record<Quadrant, number>;
  avgMargin: number;
} {
  const counts: Record<Quadrant, number> = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };
  if (items.length === 0) return { items: [], counts, avgMargin: 0 };

  const avgMargin = items.reduce((s, i) => s + margin(i), 0) / items.length;
  const avgPop = items.reduce((s, i) => s + i.popularity, 0) / items.length;

  const classified = items.map((item) => {
    const m = margin(item);
    const highMargin = m >= avgMargin;
    const highPop = item.popularity >= avgPop;
    const quadrant: Quadrant = highPop
      ? highMargin
        ? "star"
        : "plowhorse"
      : highMargin
        ? "puzzle"
        : "dog";
    counts[quadrant] += 1;
    return { ...item, margin: m, marginPct: item.price > 0 ? m / item.price : 0, quadrant };
  });

  // Stars first, then the highest-margin items within each group.
  const order: Record<Quadrant, number> = { star: 0, puzzle: 1, plowhorse: 2, dog: 3 };
  classified.sort((a, b) => order[a.quadrant] - order[b.quadrant] || b.margin - a.margin);

  return { items: classified, counts, avgMargin };
}

// Static, always-true layout levers -- the design side of menu engineering.
export const MENU_DESIGN_TIPS: { title: string; body: string }[] = [
  { title: "Box your stars", body: "Put a border or a “Chef's pick” label around your best profit-makers — a boxed item can lift ~20%." },
  { title: "Use the sweet spots", body: "Eyes land at the top of a list and the last two items — place high-margin dishes there, not in the middle." },
  { title: "Drop the dollar signs & round down", body: "Price as 14.95, not $15.00 — charm pricing softens the number without touching your margin." },
  { title: "Add a decoy anchor", body: "A deliberately pricey option (a big steak, a large pour) makes the item you want to sell look like the smart buy." },
  { title: "Rank by dollars, not percent", body: "A 30% margin on a $40 entrée beats a 70% margin on a $6 side — chase the dollars that hit the bank." },
];
