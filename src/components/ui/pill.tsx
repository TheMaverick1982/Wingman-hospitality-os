const TONE_CLASSES = {
  muted: "bg-[#EFEAE0] text-charcoal-2",
  brick: "bg-brick-tint text-brick-dark",
  gold: "bg-gold-tint text-[#8A5D18]",
  olive: "bg-olive-tint text-[#354328]",
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
