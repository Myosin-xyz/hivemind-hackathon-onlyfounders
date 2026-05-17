// "Powered by Hivemind" lockup. Brand §4: must appear on every screen.
// Three variants:
//   - dark (default): inline, white-on-dark surfaces
//   - light: dark pill wrapper, sits on light surfaces (Compare page, exports)
//   - hero: full-color gradient eye mark, full opacity (onboarding complete, landing)

import { HivemindEyeMark } from './HivemindEyeMark';

type Props = {
  variant?: 'dark' | 'light' | 'hero';
  className?: string;
};

export function HivemindLockup({ variant = 'dark', className }: Props) {
  if (variant === 'hero') {
    return (
      <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
        <HivemindEyeMark width={48} height={28} variant="fullColor" />
        <span className="font-mono text-xs uppercase tracking-[0.07em] text-white/85">
          A Hivemind product
        </span>
      </div>
    );
  }

  if (variant === 'light') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full bg-of-black px-3 py-1 ${className ?? ''}`}
      >
        <HivemindEyeMark width={18} height={11} variant="outline" />
        <span className="font-mono text-[9px] font-normal uppercase tracking-[0.07em] text-white/45">
          Powered by Hivemind
        </span>
      </div>
    );
  }

  // dark (default)
  return (
    <div className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <HivemindEyeMark width={18} height={11} variant="outline" />
      <span className="font-mono text-[9px] font-normal uppercase tracking-[0.07em] text-white/40">
        Powered by Hivemind
      </span>
    </div>
  );
}
