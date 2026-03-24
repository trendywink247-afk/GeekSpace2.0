'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
  blur?: string;
  inView?: boolean;
}

export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.4,
  yOffset = 6,
  blur = '6px',
  inView: inViewOverride,
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const detected = useInView(ref, { once: true, margin: '-50px' });
  const isInView = inViewOverride !== undefined ? inViewOverride : detected;

  return (
    <motion.div
      ref={ref}
      initial={{ y: yOffset, opacity: 0, filter: `blur(${blur})` }}
      animate={isInView ? { y: 0, opacity: 1, filter: 'blur(0px)' } : undefined}
      transition={{
        delay: 0.04 + delay,
        duration,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className={cn('transform-gpu', className)}
    >
      {children}
    </motion.div>
  );
}
