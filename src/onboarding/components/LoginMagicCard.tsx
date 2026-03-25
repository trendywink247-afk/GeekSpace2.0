import { useRef, useState, useCallback } from 'react';

interface LoginMagicCardProps {
  children: React.ReactNode;
  className?: string;
}

export function LoginMagicCard({ children, className = '' }: LoginMagicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [gradientAngle, setGradientAngle] = useState(0);
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const maxTilt = 3;
    setRotateX(-(dy / (rect.height / 2)) * maxTilt);
    setRotateY((dx / (rect.width / 2)) * maxTilt);
    setGradientAngle(Math.atan2(dy, dx) * (180 / Math.PI));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setRotateX(0);
    setRotateY(0);
    setHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      className={`relative rounded-2xl ${className}`}
      style={{
        transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: hovered
          ? 'transform 0.1s ease-out'
          : 'transform 0.4s ease-out',
      }}
    >
      {/* Gradient border glow layer */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          padding: '1px',
          background: `conic-gradient(from ${gradientAngle}deg, #8B5CF6, #F59E0B, #8B5CF6)`,
          WebkitMask:
            'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          opacity: hovered ? 0.6 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Static 1px border always visible */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
      />

      {/* Card body */}
      <div
        className="relative rounded-2xl p-6 sm:p-8 space-y-4"
        style={{
          background: 'rgba(6, 6, 26, 0.9)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow:
            '0 20px 60px rgba(139,92,246,0.08), 0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
