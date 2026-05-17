// "OnlyFounders" wordmark — Syne 800, "Only" in cheeky pink, "Founders" white.
// Tagline "OF. Not the other one." optional, shown at size >= md by default.
// Brand §3.

type Size = 'sm' | 'md' | 'lg' | 'hero';

const SIZE_CLASS: Record<Size, string> = {
  sm:   'text-2xl',                              // ~24px — inline contexts
  md:   'text-4xl',                              // ~36px — page header
  lg:   'text-6xl md:text-7xl',                  // ~60-72px — section hero
  // Monument scale that fits the viewport. clamp() caps at 7rem (~112px)
  // even on ultrawide screens — earlier 10rem overflowed the container.
  hero: 'text-[clamp(2.75rem,11vw,7rem)]',
};

const TAGLINE_CLASS: Record<Size, string> = {
  sm:   'text-[8px]',
  md:   'text-[10px]',
  lg:   'text-[11px]',
  hero: 'text-xs md:text-sm',
};

type Props = {
  size?: Size;
  showTagline?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
};

export function Wordmark({
  size = 'md',
  showTagline,
  theme = 'dark',
  className,
}: Props) {
  // Default: hide tagline for small, show for md+
  const tagline = showTagline ?? size !== 'sm';
  const founderColor = theme === 'dark' ? 'text-white' : 'text-of-black';
  const taglineColor = theme === 'dark' ? 'text-white/30' : 'text-of-black/30';

  return (
    <div className={`inline-block leading-none ${className ?? ''}`}>
      <div className={`font-display font-extrabold tracking-tight ${SIZE_CLASS[size]}`}>
        <span className="text-of-pink">Only</span>
        <span className={founderColor}>Founders</span>
      </div>
      {tagline && (
        <div
          className={`mt-1.5 font-mono uppercase tracking-[0.06em] ${TAGLINE_CLASS[size]} ${taglineColor}`}
        >
          OF. Not the other one.
        </div>
      )}
    </div>
  );
}
