export function AuthPageBackground() {
  return (
    <>
      {/* Aurora gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.08) 0%, transparent 50%)',
            'radial-gradient(ellipse at 80% 20%, rgba(16,185,129,0.06) 0%, transparent 40%)',
            'radial-gradient(ellipse at 50% 80%, rgba(245,158,11,0.04) 0%, transparent 50%)',
          ].join(', '),
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 9999,
          opacity: 0.035,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      {/* Dot grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
          maskImage:
            'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
        }}
      />

      {/* Depth blob */}
      <div
        className="fixed inset-0 pointer-events-none flex items-center justify-center animate-pulse"
        style={{ zIndex: 0 }}
      >
        <div
          style={{
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'rgba(139,92,246,0.025)',
            filter: 'blur(140px)',
            flexShrink: 0,
          }}
        />
      </div>
    </>
  );
}
