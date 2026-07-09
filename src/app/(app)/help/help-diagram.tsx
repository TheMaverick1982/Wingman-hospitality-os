// On-brand inline SVG diagrams for Help articles. No external assets — these
// render crisply at any size and in print. Colors use the brand palette
// (brick #C1440E-ish via currentColor tints handled with explicit hex here).

const BRICK = "#C0392B";
const BRICK_TINT = "#FBEAE6";
const INK = "#1A1A1A";
const MUTED = "#8A8A8A";
const LINE = "#E5E5E5";

export function HelpDiagram({ name }: { name: "retention-journey" | "roles" | "pos-sync" }) {
  if (name === "retention-journey") return <RetentionJourney />;
  if (name === "roles") return <Roles />;
  if (name === "pos-sync") return <PosSync />;
  return null;
}

function RetentionJourney() {
  const visits = ["Visit 1", "Visit 2", "Visit 3", "Visit 4+"];
  return (
    <div className="rounded-2xl border border-line bg-white p-5 overflow-x-auto">
      <svg viewBox="0 0 520 120" className="w-full min-w-[420px]" role="img" aria-label="Guest visit journey from first visit to regular">
        <line x1="40" y1="60" x2="480" y2="60" stroke={LINE} strokeWidth="2" />
        {visits.map((label, i) => {
          const x = 60 + i * 140;
          const filled = i === 0 || i === 3;
          return (
            <g key={label}>
              {i < 3 && (
                <path d={`M ${x + 18} 60 L ${x + 122} 60`} stroke={BRICK} strokeWidth="2" markerEnd="url(#arrow)" />
              )}
              <circle cx={x} cy="60" r="16" fill={filled ? BRICK : BRICK_TINT} stroke={BRICK} strokeWidth="2" />
              <text x={x} y="65" textAnchor="middle" fontSize="13" fontWeight="700" fill={filled ? "#fff" : BRICK}>
                {i + 1}
              </text>
              <text x={x} y="98" textAnchor="middle" fontSize="12" fill={MUTED}>
                {label}
              </text>
            </g>
          );
        })}
        <text x="60" y="28" textAnchor="middle" fontSize="11" fontWeight="600" fill={INK}>
          First-timer
        </text>
        <text x="480" y="28" textAnchor="middle" fontSize="11" fontWeight="600" fill={INK}>
          Regular
        </text>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={BRICK} />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

function Roles() {
  const tiers = [
    { label: "Super Admin", sub: "Owner — full access, incl. Settings & Billing", w: 460, fill: BRICK, color: "#fff" },
    { label: "Manager", sub: "Runs day-to-day — most sections", w: 360, fill: BRICK_TINT, color: BRICK },
    { label: "Staff", sub: "Shift-relevant areas + their checklist", w: 260, fill: "#fff", color: INK },
  ];
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-col items-center gap-2.5">
        {tiers.map((t) => (
          <div
            key={t.label}
            className="rounded-xl px-4 py-2.5 text-center"
            style={{ width: t.w, maxWidth: "100%", background: t.fill, color: t.color, border: `1px solid ${t.fill === "#fff" ? LINE : t.fill}` }}
          >
            <div className="text-sm font-semibold">{t.label}</div>
            <div className="text-[11.5px]" style={{ color: t.color === "#fff" ? "rgba(255,255,255,0.85)" : MUTED }}>
              {t.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PosSync() {
  const targets = ["Business Health", "Growth Planner", "Guests", "Menu"];
  return (
    <div className="rounded-2xl border border-line bg-white p-5 overflow-x-auto">
      <svg viewBox="0 0 520 200" className="w-full min-w-[440px]" role="img" aria-label="POS data flowing through the API into Wingman tools">
        {/* POS */}
        <rect x="20" y="80" width="90" height="40" rx="8" fill={BRICK_TINT} stroke={BRICK} strokeWidth="1.5" />
        <text x="65" y="104" textAnchor="middle" fontSize="13" fontWeight="700" fill={BRICK}>
          POS / Zap
        </text>
        {/* API */}
        <rect x="190" y="80" width="90" height="40" rx="8" fill={INK} />
        <text x="235" y="104" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
          API
        </text>
        <path d="M 112 100 L 186 100" stroke={BRICK} strokeWidth="2" markerEnd="url(#arrow2)" />
        {/* Targets */}
        {targets.map((t, i) => {
          const y = 30 + i * 48;
          return (
            <g key={t}>
              <path d={`M 282 100 C 330 100, 340 ${y + 15}, 380 ${y + 15}`} stroke={LINE} strokeWidth="2" fill="none" />
              <rect x="380" y={y} width="128" height="30" rx="7" fill="#fff" stroke={LINE} strokeWidth="1.5" />
              <text x="444" y={y + 19} textAnchor="middle" fontSize="12" fontWeight="600" fill={INK}>
                {t}
              </text>
            </g>
          );
        })}
        <defs>
          <marker id="arrow2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={BRICK} />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
