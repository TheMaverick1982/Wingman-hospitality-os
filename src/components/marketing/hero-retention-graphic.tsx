export function HeroRetentionGraphic() {
  return (
    <div>
      {/* lane A: one-time */}
      <div className="flex items-center gap-2.5 mb-1">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#F1F1F1] text-muted text-[11px] font-bold tracking-[0.06em]">
          ONE-TIME
        </span>
        <span className="text-[13px] text-muted-2 font-medium">Come once, gone for good</span>
      </div>
      <svg viewBox="0 0 460 148" preserveAspectRatio="xMidYMid meet" className="w-full h-auto block">
        <line x1="20" y1="120" x2="290" y2="120" stroke="#EDEDED" strokeWidth="2" />
        <path d="M300 128 L120 128" stroke="#E4E4E4" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />
        {/* grey building */}
        <rect x="300" y="52" width="140" height="68" rx="4" fill="#F3F3F3" stroke="#E4E4E4" />
        <rect x="294" y="40" width="152" height="15" rx="4" fill="#C9C9C9" />
        <rect x="356" y="80" width="30" height="40" rx="3" fill="#B0B0B0" />
        <rect x="312" y="66" width="26" height="24" rx="3" fill="#fff" stroke="#E4E4E4" />
        <rect x="404" y="66" width="26" height="24" rx="3" fill="#fff" stroke="#E4E4E4" />
        <text x="371" y="50" textAnchor="middle" fontFamily="inherit" fontSize="8.5" fontWeight="700" letterSpacing="1" fill="#fff">
          CAFÉ
        </text>
        {/* lone grey guest walks in once */}
        <g transform="translate(30,113)">
          <g style={{ animation: "wm-once 6s ease-in-out infinite" }}>
            <circle cx="0" cy="-30" r="7" fill="#BDBDBD" />
            <path d="M-7 -21 Q0 -25 7 -21 L5 -4 L-5 -4 Z" fill="#BDBDBD" />
            <rect x="-5" y="-5" width="4" height="12" rx="2" fill="#BDBDBD" />
            <rect x="1" y="-5" width="4" height="12" rx="2" fill="#BDBDBD" />
          </g>
        </g>
      </svg>

      <div className="h-px bg-[#F1F1F1] my-3.5" />

      {/* lane B: for life */}
      <div className="flex items-center gap-2.5 mb-1">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-brick-tint text-brick-dark text-[11px] font-bold tracking-[0.06em]">
          FOR LIFE
        </span>
        <span className="text-[13px] text-brick-dark font-semibold">They come back, again and again</span>
      </div>
      <svg viewBox="0 0 460 148" preserveAspectRatio="xMidYMid meet" className="w-full h-auto block">
        <line x1="20" y1="120" x2="290" y2="120" stroke="#E1ECFF" strokeWidth="2" />
        {/* loyalty loop */}
        <path
          d="M150 54 C 200 16, 320 16, 350 52"
          fill="none"
          stroke="#0A6CFF"
          strokeWidth="2.5"
          strokeDasharray="6 7"
          strokeLinecap="round"
          opacity="0.6"
          style={{ animation: "wm-loop 1.1s linear infinite" }}
        />
        <path d="M344 45 L352 53 L345 59" fill="none" stroke="#0A6CFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        {/* blue building */}
        <rect x="300" y="52" width="140" height="68" rx="4" fill="#EAF1FF" stroke="#CFE0FF" />
        <rect x="294" y="40" width="152" height="15" rx="4" fill="#0A6CFF" />
        <rect x="356" y="80" width="30" height="40" rx="3" fill="#0A6CFF" />
        <rect x="312" y="66" width="26" height="24" rx="3" fill="#fff" stroke="#CFE0FF" />
        <rect x="404" y="66" width="26" height="24" rx="3" fill="#fff" stroke="#CFE0FF" />
        <text x="371" y="50" textAnchor="middle" fontFamily="inherit" fontSize="8.5" fontWeight="700" letterSpacing="1" fill="#fff">
          CAFÉ
        </text>
        <g>
          <rect x="357" y="60" width="28" height="13" rx="3" fill="#fff" stroke="#CFE0FF" />
          <text x="371" y="69.5" textAnchor="middle" fontFamily="inherit" fontSize="7.5" fontWeight="700" fill="#0757D6">
            OPEN
          </text>
        </g>
        {/* floating hearts */}
        <path
          d="M0,2.5 C0,0.5 -3,-1 -4.5,1 C-6,3 -2,6 0,7.5 C2,6 6,3 4.5,1 C3,-1 0,0.5 0,2.5 Z"
          fill="#0A6CFF"
          transform="translate(330,40)"
          style={{ animation: "wm-heart 3s ease-in infinite" }}
        />
        <path
          d="M0,2.5 C0,0.5 -3,-1 -4.5,1 C-6,3 -2,6 0,7.5 C2,6 6,3 4.5,1 C3,-1 0,0.5 0,2.5 Z"
          fill="#4D97FF"
          transform="translate(410,42)"
          style={{ animation: "wm-heart 3s ease-in 1.5s infinite" }}
        />
        {/* streaming returning guests */}
        <g transform="translate(30,113)">
          <g style={{ animation: "wm-walk 4s linear -3s infinite" }}>
            <circle cx="0" cy="-30" r="7" fill="#0A6CFF" />
            <path d="M-7 -21 Q0 -25 7 -21 L5 -4 L-5 -4 Z" fill="#0A6CFF" />
            <rect x="-5" y="-5" width="4" height="12" rx="2" fill="#0A6CFF" />
            <rect x="1" y="-5" width="4" height="12" rx="2" fill="#0A6CFF" />
          </g>
        </g>
        <g transform="translate(30,113)">
          <g style={{ animation: "wm-walk 4s linear -2s infinite" }}>
            <circle cx="0" cy="-30" r="7" fill="#4D97FF" />
            <path d="M-7 -21 Q0 -25 7 -21 L5 -4 L-5 -4 Z" fill="#4D97FF" />
            <rect x="-5" y="-5" width="4" height="12" rx="2" fill="#4D97FF" />
            <rect x="1" y="-5" width="4" height="12" rx="2" fill="#4D97FF" />
          </g>
        </g>
        <g transform="translate(30,113)">
          <g style={{ animation: "wm-walk 4s linear -1s infinite" }}>
            <circle cx="0" cy="-30" r="7" fill="#0A6CFF" />
            <path d="M-7 -21 Q0 -25 7 -21 L5 -4 L-5 -4 Z" fill="#0A6CFF" />
            <rect x="-5" y="-5" width="4" height="12" rx="2" fill="#0A6CFF" />
            <rect x="1" y="-5" width="4" height="12" rx="2" fill="#0A6CFF" />
          </g>
        </g>
        <g transform="translate(30,113)">
          <g style={{ animation: "wm-walk 4s linear 0s infinite" }}>
            <circle cx="0" cy="-30" r="7" fill="#4D97FF" />
            <path d="M-7 -21 Q0 -25 7 -21 L5 -4 L-5 -4 Z" fill="#4D97FF" />
            <rect x="-5" y="-5" width="4" height="12" rx="2" fill="#4D97FF" />
            <rect x="1" y="-5" width="4" height="12" rx="2" fill="#4D97FF" />
          </g>
        </g>
      </svg>
    </div>
  );
}
