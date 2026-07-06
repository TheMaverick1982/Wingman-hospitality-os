const TONE_CLASSES = {
  muted: "bg-[#f2f2f7] text-charcoal-2",
  brick: "bg-brick-tint text-brick-dark",
  gold: "bg-gold-tint text-[#92400e]",
  olive: "bg-olive-tint text-[#166534]",
} as const;

export function Pill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={`${TONE_CLASSES[tone]} px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap`}
    >
      {children}
    </span>
  );
}
