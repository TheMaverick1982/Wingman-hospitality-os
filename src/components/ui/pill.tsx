const TONE_CLASSES = {
  muted: "bg-[#f1f1f1] text-charcoal-2",
  brick: "bg-brick-tint text-brick-dark",
  gold: "bg-gold-tint text-[#b45309]",
  olive: "bg-olive-tint text-[#15803d]",
  danger: "bg-danger-tint text-danger",
} as const;

const DOT_CLASSES = {
  muted: "bg-muted-2",
  brick: "bg-brick",
  gold: "bg-gold",
  olive: "bg-[#16a34a]",
  danger: "bg-[#dc2626]",
} as const;

export function Pill({
  children,
  tone = "muted",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_CLASSES;
  dot?: boolean;
}) {
  return (
    <span
      className={`${TONE_CLASSES[tone]} inline-flex items-center gap-1.5 px-[13px] py-[6px] rounded-full text-[13px] font-semibold whitespace-nowrap`}
    >
      {dot && <span className={`${DOT_CLASSES[tone]} w-[7px] h-[7px] rounded-full shrink-0`} />}
      {children}
    </span>
  );
}
