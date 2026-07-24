/** Decorative SVG sparkline using prototype `animate-drawline`. */
export function DrawlineSpark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        className="animate-drawline"
        d="M2 48 C28 46, 36 20, 58 28 C78 36, 88 12, 112 18 C136 24, 148 44, 172 36 C196 28, 208 8, 238 14"
        stroke="#FDD458"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1000}
      />
      <path
        d="M2 48 C28 46, 36 20, 58 28 C78 36, 88 12, 112 18 C136 24, 148 44, 172 36 C196 28, 208 8, 238 14 L238 64 L2 64 Z"
        fill="url(#sparkFill)"
        opacity="0.18"
      />
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDD458" />
          <stop offset="100%" stopColor="#FDD458" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
