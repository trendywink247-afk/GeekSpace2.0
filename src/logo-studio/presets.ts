import type { LogoParams } from './types';

const base: LogoParams = {
  shape: 'squircle', cornerRadius: 7, gradientFrom: '#8B5CF6', gradientTo: '#F59E0B',
  gradientAngle: 135, letterStrokeWidth: 2.5, crossbarY: 0.6, crossbarThickness: 3,
  crossbarStyle: 'solid', innerElement: 'none', agentDotColor: '#10B981',
  showGlowRing: false, glowOpacity: 0.2,
};

const p = (name: string, overrides: Partial<LogoParams>): { name: string; params: LogoParams } => ({
  name,
  params: { ...base, ...overrides },
});

export const PRESETS: { name: string; params: LogoParams }[] = [
  // 1. Classic D logo
  p('Negative Space', {}),

  // 2. D1 — chat bubble variant
  p('Chat Bubble', { shape: 'chat-left', crossbarStyle: 'agent-dots' }),

  // 3. D2 — agent network
  p('Agent Network', { innerElement: 'constellation' }),

  // 4. D3 — AI pulse
  p('AI Pulse', { shape: 'chat-right', innerElement: 'ai-eye' }),

  // 5. Option A — neural mono violet
  p('Neural A', {
    gradientTo: '#8B5CF6', crossbarStyle: 'agent-dots', innerElement: 'neural',
  }),

  // 6. Option F — circle mark
  p('Circle Mark', { shape: 'circle' }),

  // 7. Option G — hybrid glow
  p('Hybrid Glow', {
    gradientTo: '#8B5CF6', innerElement: 'neural', showGlowRing: true, glowOpacity: 0.3,
  }),

  // 8. Green theme variant
  p('Emerald Agent', {
    gradientFrom: '#10B981', gradientAngle: 225, crossbarStyle: 'agent-dots',
    innerElement: 'constellation', agentDotColor: '#8B5CF6',
  }),

  // 9. Clean minimal
  p('Minimal', {
    cornerRadius: 10, gradientFrom: '#7C3AED', gradientTo: '#EC4899',
    letterStrokeWidth: 2,
  }),

  // 10. Maximum features
  p('Full Agent', {
    shape: 'chat-left', gradientFrom: '#6D28D9', gradientAngle: 160,
    crossbarStyle: 'agent-dots', innerElement: 'constellation',
    showGlowRing: true, glowOpacity: 0.25,
  }),
];
