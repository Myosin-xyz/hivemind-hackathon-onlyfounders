// Hivemind eye mark — two lens shapes with a neon asterisk above.
// Source: only-founders-brand.md §3.
// Use `fullColor` for hero contexts; default `outline` for inline lockups.

type Props = {
  width?: number;
  height?: number;
  variant?: 'outline' | 'fullColor';
  className?: string;
};

export function HivemindEyeMark({
  width = 18,
  height = 11,
  variant = 'outline',
  className,
}: Props) {
  if (variant === 'fullColor') {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 64 36"
        fill="none"
        className={className}
        aria-label="Hivemind"
      >
        <defs>
          <radialGradient id="hm-eye-l" cx="38%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#B8C83A" />
            <stop offset="100%" stopColor="#C800AA" />
          </radialGradient>
          <radialGradient id="hm-eye-r" cx="38%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#B8C83A" />
            <stop offset="100%" stopColor="#C800AA" />
          </radialGradient>
        </defs>
        <line x1="32" y1="0" x2="32" y2="7" stroke="#C966FF" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="28" y1="1.5" x2="36" y2="5.5" stroke="#C966FF" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        <line x1="36" y1="1.5" x2="28" y2="5.5" stroke="#C966FF" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        <line x1="24" y1="3.5" x2="40" y2="3.5" stroke="#C966FF" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        <path d="M2 18 Q16 8 32 18 Q16 28 2 18Z" fill="url(#hm-eye-l)" />
        <line x1="11" y1="18" x2="21" y2="18" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M32 18 Q46 8 62 18 Q46 28 32 18Z" fill="url(#hm-eye-r)" />
        <line x1="43" y1="18" x2="53" y2="18" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  // Outline variant (default): white-on-dark, sized for inline lockups.
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 36"
      fill="none"
      className={className}
      aria-label="Hivemind"
    >
      <path d="M2 18 Q16 8 32 18 Q16 28 2 18Z" fill="white" opacity="0.5" />
      <line x1="9" y1="18" x2="19" y2="18" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M32 18 Q46 8 62 18 Q46 28 32 18Z" fill="white" opacity="0.5" />
      <line x1="45" y1="18" x2="55" y2="18" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="32" y1="0" x2="32" y2="6" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="29" y1="1.5" x2="35" y2="4.5" stroke="white" strokeWidth="1" opacity="0.3" />
      <line x1="35" y1="1.5" x2="29" y2="4.5" stroke="white" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}
