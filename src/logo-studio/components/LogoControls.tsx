import { type LogoParams, PARAM_RANGES } from '../types';

interface LogoControlsProps {
  params: LogoParams;
  onChange: (params: LogoParams) => void;
  onRandomize: () => void;
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="text-xs text-[#94A3B8]">{label}</span>
        <span className="text-xs text-white/50 font-mono">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-[#8B5CF6] cursor-pointer"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium mb-3 mt-6 first:mt-0">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      active ? 'bg-[#8B5CF6] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`}>
      {children}
    </button>
  );
}

function ColorInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#94A3B8] w-10">{label}</span>
      <label className="relative cursor-pointer">
        <div className="w-5 h-5 rounded border border-white/10" style={{ backgroundColor: value }} />
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </label>
      <span className="text-xs text-white/50 font-mono">{value}</span>
    </div>
  );
}

const SHAPES = [
  { value: 'squircle' as const, icon: <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { value: 'circle' as const, icon: <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { value: 'chat-left' as const, icon: <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 2h10v8H6l-3 3v-3H2V2z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg> },
  { value: 'chat-right' as const, icon: <svg width="14" height="14" viewBox="0 0 14 14"><path d="M12 2H2v8h6l3 3v-3h1V2z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg> },
] as const;

export function LogoControls({ params, onChange, onRandomize }: LogoControlsProps) {
  const update = <K extends keyof LogoParams>(key: K, value: LogoParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const r = PARAM_RANGES;

  return (
    <div className="overflow-y-auto p-5">
      {/* Shape */}
      <Section title="Shape">
        <div className="flex gap-2">
          {SHAPES.map(s => (
            <Pill key={s.value} active={params.shape === s.value} onClick={() => update('shape', s.value)}>
              <span className="flex items-center gap-1.5">{s.icon}{s.value}</span>
            </Pill>
          ))}
        </div>
        {params.shape !== 'circle' && (
          <Slider label={r.cornerRadius.label} value={params.cornerRadius}
            min={r.cornerRadius.min} max={r.cornerRadius.max} step={r.cornerRadius.step}
            onChange={v => update('cornerRadius', v)} />
        )}
      </Section>

      {/* Gradient */}
      <Section title="Gradient">
        <div className="flex gap-6">
          <ColorInput label="From" value={params.gradientFrom} onChange={v => update('gradientFrom', v)} />
          <ColorInput label="To" value={params.gradientTo} onChange={v => update('gradientTo', v)} />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#94A3B8]">{r.gradientAngle.label}</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border border-white/20 relative">
                <div className="absolute w-1.5 h-0.5 bg-[#8B5CF6] rounded-full top-1/2 left-1/2 origin-left"
                  style={{ transform: `translate(-50%, -50%) rotate(${params.gradientAngle - 90}deg) translateX(25%)` }} />
              </div>
              <span className="text-xs text-white/50 font-mono">{params.gradientAngle}deg</span>
            </div>
          </div>
          <input type="range" min={r.gradientAngle.min} max={r.gradientAngle.max}
            step={r.gradientAngle.step} value={params.gradientAngle}
            onChange={e => update('gradientAngle', Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-[#8B5CF6] cursor-pointer" />
        </div>
      </Section>

      {/* Letterform */}
      <Section title="Letterform">
        <Slider label="Weight" value={params.letterStrokeWidth}
          min={r.letterStrokeWidth.min} max={r.letterStrokeWidth.max} step={r.letterStrokeWidth.step}
          onChange={v => update('letterStrokeWidth', v)} />
        <Slider label="Crossbar Position" value={params.crossbarY}
          min={r.crossbarY.min} max={r.crossbarY.max} step={r.crossbarY.step}
          onChange={v => update('crossbarY', v)} />
        <Slider label="Crossbar Width" value={params.crossbarThickness}
          min={r.crossbarThickness.min} max={r.crossbarThickness.max} step={r.crossbarThickness.step}
          onChange={v => update('crossbarThickness', v)} />
      </Section>

      {/* Crossbar Style */}
      <Section title="Crossbar">
        <div className="flex gap-2">
          {(['solid', 'agent-dots', 'none'] as const).map(style => (
            <Pill key={style} active={params.crossbarStyle === style}
              onClick={() => update('crossbarStyle', style)}>
              {style === 'agent-dots' ? 'Agent Dots' : style.charAt(0).toUpperCase() + style.slice(1)}
            </Pill>
          ))}
        </div>
        {params.crossbarStyle === 'agent-dots' && (
          <ColorInput label="Dots" value={params.agentDotColor} onChange={v => update('agentDotColor', v)} />
        )}
      </Section>

      {/* Inner Element */}
      <Section title="Inner Element">
        <div className="flex flex-wrap gap-2">
          {(['none', 'constellation', 'ai-eye', 'neural'] as const).map(el => (
            <Pill key={el} active={params.innerElement === el}
              onClick={() => update('innerElement', el)}>
              {el === 'ai-eye' ? 'AI Eye' : el.charAt(0).toUpperCase() + el.slice(1)}
            </Pill>
          ))}
        </div>
      </Section>

      {/* Effects */}
      <Section title="Effects">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#94A3B8]">Glow Ring</span>
          <button onClick={() => update('showGlowRing', !params.showGlowRing)}
            className={`w-[20px] h-[12px] rounded-full relative transition-colors ${
              params.showGlowRing ? 'bg-[#8B5CF6]' : 'bg-white/20'
            }`}>
            <div className={`absolute top-[1px] w-[10px] h-[10px] rounded-full bg-white transition-transform ${
              params.showGlowRing ? 'left-[9px]' : 'left-[1px]'
            }`} />
          </button>
        </div>
        {params.showGlowRing && (
          <Slider label={r.glowOpacity.label} value={params.glowOpacity}
            min={r.glowOpacity.min} max={r.glowOpacity.max} step={r.glowOpacity.step}
            onChange={v => update('glowOpacity', v)} />
        )}
      </Section>

      {/* Randomize */}
      <button onClick={onRandomize}
        className="w-full mt-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] hover:opacity-90 transition-opacity">
        Randomize
      </button>
    </div>
  );
}
