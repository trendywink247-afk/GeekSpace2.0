'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NumberTickerProps {
  value: number;
  direction?: 'up' | 'down';
  delay?: number;
  decimalPlaces?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function NumberTicker({
  value,
  direction = 'up',
  delay = 0,
  decimalPlaces = 0,
  className,
  prefix = '',
  suffix = '',
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [hasStarted, setHasStarted] = useState(false);

  const motionValue = useSpring(direction === 'down' ? value : 0, {
    stiffness: 60,
    damping: 30,
    mass: 1,
  });

  const display = useTransform(motionValue, (latest) => {
    return `${prefix}${Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(Number(latest.toFixed(decimalPlaces)))}${suffix}`;
  });

  useEffect(() => {
    if (isInView && !hasStarted) {
      const timeout = setTimeout(() => {
        motionValue.set(direction === 'down' ? 0 : value);
        setHasStarted(true);
      }, delay * 1000);
      return () => clearTimeout(timeout);
    }
  }, [isInView, hasStarted, value, direction, delay, motionValue]);

  return (
    <motion.span
      ref={ref}
      className={cn('inline-block tabular-nums tracking-tight', className)}
    >
      {display}
    </motion.span>
  );
}
