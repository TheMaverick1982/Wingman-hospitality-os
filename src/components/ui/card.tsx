export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-panel border border-line rounded-[10px] ${className}`}>{children}</div>
  );
}
