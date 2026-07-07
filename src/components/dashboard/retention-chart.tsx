const WIDTH = 560;
const HEIGHT = 180;
const PAD = 24;

export function RetentionChart({ counts, labels }: { counts: number[]; labels: string[] }) {
  const max = Math.max(...counts, 1);
  const stepX = (WIDTH - PAD * 2) / (counts.length - 1);
  const points = counts.map((c, i) => {
    const x = PAD + i * stepX;
    const y = HEIGHT - PAD - (c / max) * (HEIGHT - PAD * 2);
    return { x, y, value: c };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${HEIGHT - PAD} L ${points[0].x} ${HEIGHT - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="retention-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brick)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-brick)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#retention-fill)" />
      <path d={linePath} fill="none" stroke="var(--color-brick)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--color-panel)" stroke="var(--color-brick)" strokeWidth={2} />
      ))}
      {labels.map((label, i) => (
        <text
          key={label}
          x={points[i].x}
          y={HEIGHT - 4}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-muted)"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
