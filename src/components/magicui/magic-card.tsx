'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MagicCardProps {
  children: React.ReactNode;
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
}

export function MagicCard({
  children,
  className,
  gradientSize = 250,
  gradientColor = '#8B5CF6',
  gradientOpacity = 0.15,
}: MagicCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <motion.div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--layer-card)]',
        'transform-gpu transition-colors duration-300',
        className,
      )}
    >
      {/* Spotlight gradient overlay */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(${gradientSize}px circle at ${position.x}px ${position.y}px, ${gradientColor}, transparent 65%)`,
          filter: `opacity(${gradientOpacity})`,
        }}
      />
      {/* Top-edge refraction line */}
      <div
        className="pointer-events-none absolute left-[10%] right-[10%] top-0 h-px transition-opacity duration-300"
        style={{
          opacity: opacity * 0.6,
          background: `linear-gradient(90deg, transparent, ${gradientColor}40, transparent)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
