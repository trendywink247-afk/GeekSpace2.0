import { CalendarCheck, Sparkles } from 'lucide-react';

// Priority color coding (design system)
const PRIORITY_COLORS = [
  { label: 'P1', color: '#EF4444' },
  { label: 'P2', color: '#F97316' },
  { label: 'P3', color: '#EAB308' },
  { label: 'P4', color: '#6B7280' },
];

// Agent avatars (design system)
const FLEET_AGENTS = [
  { letter: 'W', name: 'Weebo', color: '#00F0FF' },
  { letter: 'E', name: 'Edith', color: '#8B5CF6' },
  { letter: 'J', name: 'Jarvis', color: '#ADFF2F' },
];

export function PlannerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E8E8F0]">Planner</h1>
        <p className="text-sm text-[#9CA3AF] mt-1">Plan your AI fleet's tasks. Assign work to different agents.</p>
      </div>

      <div
        className="rounded-2xl border border-[#00F0FF]/10 p-8 sm:p-12 flex flex-col items-center justify-center text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="w-16 h-16 rounded-2xl bg-[#ADFF2F]/10 border border-[#ADFF2F]/20 flex items-center justify-center mb-6">
          <CalendarCheck className="w-8 h-8 text-[#ADFF2F]" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ADFF2F]/10 text-[#ADFF2F] border border-[#ADFF2F]/20 mb-4">
          <Sparkles className="w-3 h-3" />
          Coming Soon
        </span>

        <h2 className="text-lg font-semibold text-[#E8E8F0] mb-2">Weebo Task Planner</h2>
        <p className="text-sm text-[#9CA3AF] max-w-md mb-6">
          Plan your AI fleet's tasks. Assign work to different agents and
          break down goals into actionable tasks with AI-powered orchestration.
        </p>

        {/* Fleet agent avatars */}
        <div className="flex items-center gap-3 mb-6">
          {FLEET_AGENTS.map((agent) => (
            <div key={agent.letter} className="flex flex-col items-center gap-1.5">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: `${agent.color}20`,
                  border: `2px solid ${agent.color}`,
                  color: agent.color,
                }}
              >
                {agent.letter}
              </span>
              <span className="text-xs text-[#9CA3AF]">{agent.name}</span>
            </div>
          ))}
        </div>

        {/* Priority color legend */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-xs text-[#9CA3AF] mr-1">Priorities:</span>
          {PRIORITY_COLORS.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border"
              style={{
                borderColor: `${p.color}40`,
                color: p.color,
                backgroundColor: `${p.color}10`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
