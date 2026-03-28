import { useState, useCallback, useEffect } from 'react';
import { DEFAULT_PARAMS, PARAM_RANGES } from './types';
import type { LogoParams, LogoVariant } from './types';
import { generateSVGString } from './LogoEngine';

const STORAGE_KEY = 'gs-logo-variants';
const MAX_VARIANTS = 20;

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function useLogoStudio() {
  const [params, setParams] = useState<LogoParams>(DEFAULT_PARAMS);
  const [variants, setVariants] = useState<LogoVariant[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);

  // Load variants from localStorage on mount
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setVariants(JSON.parse(raw));
    } catch { /* ignore corrupt data */ }
  }, []);

  // Persist variants to localStorage on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(variants)); } catch { /* quota */ }
  }, [variants]);

  const updateParam = useCallback(<K extends keyof LogoParams>(key: K, value: LogoParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const saveVariant = useCallback((name?: string) => {
    const variant: LogoVariant = {
      id: generateId(),
      params: { ...params },
      name: name || `Variant ${variants.length + 1}`,
      timestamp: Date.now(),
    };
    setVariants(prev => [variant, ...prev].slice(0, MAX_VARIANTS));
  }, [params, variants.length]);

  const loadVariant = useCallback((variant: LogoVariant) => {
    setParams(variant.params);
    setActiveVariantId(variant.id);
  }, []);

  const deleteVariant = useCallback((id: string) => {
    setVariants(prev => prev.filter(v => v.id !== id));
    setActiveVariantId(prev => prev === id ? null : prev);
  }, []);

  const randomize = useCallback(() => {
    const shapes: LogoParams['shape'][] = ['squircle', 'circle', 'chat-left', 'chat-right'];
    const crossbarStyles: LogoParams['crossbarStyle'][] = ['solid', 'agent-dots', 'none'];
    const innerElements: LogoParams['innerElement'][] = ['none', 'constellation', 'ai-eye', 'neural'];
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const rand = (r: { min: number; max: number }) => r.min + Math.random() * (r.max - r.min);

    const hues = [270, 160, 40, 0, 330];
    const randomColor = () => {
      const hue = hues[Math.floor(Math.random() * hues.length)] + (Math.random() * 30 - 15);
      return hslToHex(hue, 50 + Math.random() * 40, 40 + Math.random() * 30);
    };

    setParams({
      shape: pick(shapes),
      cornerRadius: rand(PARAM_RANGES.cornerRadius),
      gradientFrom: randomColor(),
      gradientTo: randomColor(),
      gradientAngle: rand(PARAM_RANGES.gradientAngle),
      letterStrokeWidth: rand(PARAM_RANGES.letterStrokeWidth),
      crossbarY: rand(PARAM_RANGES.crossbarY),
      crossbarThickness: rand(PARAM_RANGES.crossbarThickness),
      crossbarStyle: pick(crossbarStyles),
      innerElement: pick(innerElements),
      agentDotColor: randomColor(),
      showGlowRing: Math.random() > 0.5,
      glowOpacity: rand(PARAM_RANGES.glowOpacity),
    });
    setActiveVariantId(null);
  }, []);

  const svgString = generateSVGString(params, 32);

  const exportSVG = useCallback(() => {
    const svg = generateSVGString(params, 512);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agentin-logo.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [params]);

  const copySVGCode = useCallback(async () => {
    await navigator.clipboard.writeText(generateSVGString(params, 32));
  }, [params]);

  return {
    params,
    setParams,
    updateParam,
    variants,
    activeVariantId,
    saveVariant,
    loadVariant,
    deleteVariant,
    randomize,
    exportSVG,
    copySVGCode,
    svgString,
  };
}
