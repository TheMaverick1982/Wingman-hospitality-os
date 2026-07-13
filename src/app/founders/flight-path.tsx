// A guest's journey taking off — a dotted route climbing from the first visit
// up to "regular," with the Wingman plane at the lead. Pure inline SVG, scales
// crisply. Light-theme colors to sit on the founders page's paper background.
export function FoundersFlightPath({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 190" className={className} role="img" aria-label="A guest journey taking off from first visit to loyal regular">
      <defs>
        <linearGradient id="fp-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a6cff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#0a6cff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fp-line" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#0757d6" />
        </linearGradient>
      </defs>
      <line x1="24" y1="166" x2="336" y2="166" stroke="#0a6cff" strokeOpacity="0.12" strokeWidth="1" />
      <path d="M 34 158 C 120 156 165 122 205 96 C 250 66 296 44 322 30 L 322 166 L 34 166 Z" fill="url(#fp-area)" />
      <path d="M 34 158 C 120 156 165 122 205 96 C 250 66 296 44 322 30" fill="none" stroke="url(#fp-line)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.5 9" />
      <circle cx="34" cy="158" r="4.5" fill="#ffffff" stroke="#0a6cff" strokeWidth="2" />
      <circle cx="120" cy="132" r="3.5" fill="#0a6cff" fillOpacity="0.4" />
      <circle cx="205" cy="96" r="4.5" fill="#0a6cff" fillOpacity="0.7" />
      <g transform="translate(322,30) rotate(-33)">
        <path d="M -15 8 L 16 0 L -15 -8 L -9 0 Z" fill="url(#fp-line)" />
      </g>
      <text x="34" y="182" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#8a8a8a">First visit</text>
      <text x="322" y="20" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0757d6">Regular</text>
    </svg>
  );
}
