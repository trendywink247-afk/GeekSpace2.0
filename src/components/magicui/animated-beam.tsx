'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedBeamProps {
  containerRef: React.RefObject<HTMLElement>;
  fromRef: React.RefObject<HTMLElement>;
  toRef: React.RefObject<HTMLElement>;
  curvature?: number;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
  className?: string;
}

export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 2,
  delay = 0,
  pathColor = 'rgba(255,255,255,0.1)',
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = '#8B5CF6',
  gradientStopColor = '#F59E0B',
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  className,
}: AnimatedBeamProps) {
  const [pathD, setPathD] = useState('');
  const [svgDims, setSvgDims] = useState({ width: 0, height: 0 });
  const id = useRef(`beam-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current || !fromRef.current || !toRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const fromRect = fromRef.current.getBoundingClientRect();
      const toRect = toRef.current.getBoundingClientRect();

      const startX = fromRect.left - containerRect.left + fromRect.width / 2 + startXOffset;
      const startY = fromRect.top - containerRect.top + fromRect.height / 2 + startYOffset;
      const endX = toRect.left - containerRect.left + toRect.width / 2 + endXOffset;
      const endY = toRect.top - containerRect.top + toRect.height / 2 + endYOffset;

      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2 + curvature;

      setSvgDims({ width: containerRect.width, height: containerRect.height });
      setPathD(`M ${startX},${startY} Q ${midX},${midY} ${endX},${endY}`);
    };

    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset]);

  return (
    <svg
      fill="none"
      width={svgDims.width}
      height={svgDims.height}
      xmlns="http://www.w3.org/2000/svg"
      className={cn('pointer-events-none absolute left-0 top-0 transform-gpu', className)}
    >
      <defs>
        <linearGradient id={`grad-${id.current}`} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={gradientStartColor} stopOpacity="0" />
          <stop offset="50%" stopColor={gradientStartColor} stopOpacity="1" />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Background path */}
      <path d={pathD} stroke={pathColor} strokeWidth={pathWidth} strokeOpacity={pathOpacity} strokeLinecap="round" />
      {/* Animated beam */}
      <motion.path
        d={pathD}
        stroke={`url(#grad-${id.current})`}
        strokeWidth={pathWidth}
        strokeLinecap="round"
        initial={{ pathLength: 0, pathOffset: reverse ? 1 : 0 }}
        animate={{ pathLength: 0.3, pathOffset: reverse ? [1, 0] : [0, 1] }}
        transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  );
}
