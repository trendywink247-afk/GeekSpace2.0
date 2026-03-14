import { CalendarCheck, Sparkles } from 'lucide-react';

export function PlannerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E8E8F0]">Planner</h1>
        <p className="text-sm text-[#9CA3AF] mt-1">Orchestrate multi-step tasks with Weebo agents</p>
      </div>

      <div
        className="rounded-2xl border border-[#00F0FF]/10 p-12 flex flex-col items-center justify-center text-center"
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
        <p className="text-sm text-[#9CA3AF] max-w-md">
          Plan complex multi-step workflows and let your Weebo fleet execute them autonomously.
          Break down goals into actionable tasks with AI-powered orchestration.
        </p>
      </div>
    </div>
  );
}
