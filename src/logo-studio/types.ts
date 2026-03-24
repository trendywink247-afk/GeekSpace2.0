export interface LogoParams {
  shape: 'squircle' | 'circle' | 'chat-left' | 'chat-right';
  cornerRadius: number;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  letterStrokeWidth: number;
  crossbarY: number;
  crossbarThickness: number;
  crossbarStyle: 'solid' | 'agent-dots' | 'none';
  innerElement: 'none' | 'constellation' | 'ai-eye' | 'neural';
  agentDotColor: string;
  showGlowRing: boolean;
  glowOpacity: number;
}

export interface LogoVariant {
  id: string;
  params: LogoParams;
  name: string;
  timestamp: number;
}

export const DEFAULT_PARAMS: LogoParams = {
  shape: 'squircle',
  cornerRadius: 7,
  gradientFrom: '#8B5CF6',
  gradientTo: '#F59E0B',
  gradientAngle: 135,
  letterStrokeWidth: 2.5,
  crossbarY: 0.6,
  crossbarThickness: 3,
  crossbarStyle: 'solid',
  innerElement: 'none',
  agentDotColor: '#10B981',
  showGlowRing: false,
  glowOpacity: 0.2,
};

export const PARAM_RANGES: Record<string, { min: number; max: number; step: number; label: string }> = {
  cornerRadius: { min: 2, max: 15, step: 0.5, label: 'Corner Radius' },
  gradientAngle: { min: 0, max: 360, step: 5, label: 'Gradient Angle' },
  letterStrokeWidth: { min: 1, max: 4, step: 0.1, label: 'Letter Weight' },
  crossbarY: { min: 0.4, max: 0.75, step: 0.01, label: 'Crossbar Position' },
  crossbarThickness: { min: 0.5, max: 5, step: 0.1, label: 'Crossbar Width' },
  glowOpacity: { min: 0, max: 1, step: 0.05, label: 'Glow Intensity' },
};
