// Decorative low-opacity radial glows. Signal the Hivemind layer working
// beneath the surface. Brand §1, ambient glow section.
//
// Always position:absolute, pointer-events:none. Sit behind all content.
// Parent must be position:relative + overflow-hidden.

export function AmbientGlows() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Magenta — top left */}
      <div
        className="absolute"
        style={{
          top: '-60px',
          left: '-80px',
          width: '320px',
          height: '320px',
          background: 'rgba(200,0,170,0.18)',
          filter: 'blur(70px)',
          borderRadius: '50%',
        }}
      />
      {/* Blue — top right */}
      <div
        className="absolute"
        style={{
          top: '-40px',
          right: '-60px',
          width: '240px',
          height: '240px',
          background: 'rgba(26,109,255,0.14)',
          filter: 'blur(60px)',
          borderRadius: '50%',
        }}
      />
      {/* Lime — bottom center (subtle) */}
      <div
        className="absolute"
        style={{
          bottom: '-40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '180px',
          height: '180px',
          background: 'rgba(184,200,58,0.10)',
          filter: 'blur(50px)',
          borderRadius: '50%',
        }}
      />
    </div>
  );
}
