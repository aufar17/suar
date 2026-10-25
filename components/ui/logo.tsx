/** Suar mark: a flame over a 5 km grid. Colors follow the theme tokens. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path d="M6 22h20M6 26h20M10 18v10M16 18v10M22 18v10" stroke="var(--primary-foreground)" strokeOpacity="0.35" strokeWidth="1.2" />
      <path
        d="M16 5c1.2 3.2 5.5 5.6 5.5 10.2A5.5 5.5 0 0 1 16 20.7a5.5 5.5 0 0 1-5.5-5.5c0-2.4 1.3-3.9 2.5-5.1.2 1.6.9 2.7 2 3.2C14.6 10 15 7.5 16 5Z"
        fill="var(--ember)"
      />
    </svg>
  );
}
