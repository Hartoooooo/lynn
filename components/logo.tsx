export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
      <path d="M22 16v32h22" fill="none" stroke="#1f1e1d" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="44" cy="20" r="4.5" fill="#1f1e1d" />
    </svg>
  );
}
