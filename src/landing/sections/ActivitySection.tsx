import { motion } from 'framer-motion';
import { MessageSquare, Calendar, Send, CheckCircle, TrendingUp, Clock, XCircle } from 'lucide-react';

interface Activity {
  id: number;
  company: string;
  action: string;
  icon: typeof MessageSquare;
  time: string;
  color: string;
}

const activities: Activity[] = [
  { id: 1, company: 'Cal', action: 'Reminder: Team standup in 15 minutes', icon: Calendar, time: 'now', color: '#4ECDC4' },
  { id: 2, company: 'Weebo', action: 'answered 3 questions about GST filing', icon: MessageSquare, time: '2s ago', color: '#00F0FF' },
  { id: 3, company: 'Cal', action: 'scheduled meeting with Rahul at 3 PM', icon: Calendar, time: '8s ago', color: '#4ECDC4' },
  { id: 4, company: 'Aria', action: 'drafting social media banner copy', icon: Send, time: '12s ago', color: '#FF2D78' },
  { id: 5, company: 'Forge', action: 'deployed REST API endpoint to production', icon: CheckCircle, time: '22s ago', color: '#FFB800' },
  { id: 6, company: 'Pulse', action: 'analyzing Q1 revenue trends', icon: TrendingUp, time: '31s ago', color: '#00FF88' },
  { id: 7, company: 'Echo', action: 'summarized 12 unread emails from clients', icon: MessageSquare, time: '45s ago', color: '#FF6B35' },
  { id: 8, company: 'Jarvis', action: 'fixed TypeScript build error in auth module', icon: CheckCircle, time: '1m ago', color: '#ADFF2F' },
  { id: 9, company: 'Nova', action: 'generating dashboard wireframes', icon: Clock, time: '2m ago', color: '#E040FB' },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export function ActivitySection() {
  return (
    <section
      id="activity"
      className="relative py-20 md:py-28 lg:py-32 overflow-hidden"
    >
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes livePulse {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(2); }
        }
      `}</style>

      {/* Data River Background */}
      <div className="absolute inset-0 pointer-events-none dot-grid" style={{ opacity: 0.05 }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Left: Header & Stats */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="lg:col-span-1"
          >
            {/* Mono badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00FF88]/5 border border-[#00FF88]/20 mb-6">
              <span className="font-mono text-[11px] tracking-wider text-[#00FF88]/70 uppercase">Real-Time</span>
            </div>

            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Your Agents, <span className="text-gradient">Always Working</span>
            </h2>
            <p className="text-lg text-[#6B7280] mb-8">
              While you focus on what matters, your AI team handles everything else -- around the clock, in parallel.
            </p>

            {/* Stats as colored badges */}
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">5</span>
                <span className="text-xs text-emerald-400/70">completed</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">3</span>
                <span className="text-xs text-amber-400/70">in progress</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-red-400">0</span>
                <span className="text-xs text-red-400/70">failed</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Activity Feed in Glass Container */}
          <div className="lg:col-span-2">
            <div
              className="overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '20px',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.04), 0 0 40px rgba(0,0,0,0.3)',
              }}
            >
              {/* Feed header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                <span className="text-sm font-medium text-[#F4F6FF]">Agent Activity</span>
                <div className="flex items-center gap-2">
                  {/* Live pulse dot */}
                  <span className="relative flex h-2.5 w-2.5">
                    <span
                      className="absolute inset-0 rounded-full bg-[#00FF88]"
                      style={{ animation: 'livePulse 1.5s ease-out infinite' }}
                    />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00FF88]" />
                  </span>
                  <span className="font-mono text-[11px] tracking-wider text-[#00FF88]/80 uppercase">Live</span>
                </div>
              </div>

              {/* Staggered activity items */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.1 }}
                className="p-3 space-y-2"
              >
                {activities.map((activity) => (
                  <motion.div
                    key={activity.id}
                    variants={itemVariants}
                    className="relative flex items-center gap-3 p-3 rounded-xl transition-colors duration-200 hover:bg-white/[0.02]"
                    style={{
                      background: 'rgba(255,255,255,0.015)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderLeft: `2px solid ${activity.color}30`,
                    }}
                  >
                    {/* Agent avatar with colored glow */}
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{
                          backgroundColor: `${activity.color}20`,
                          boxShadow: `0 0 12px ${activity.color}20`,
                        }}
                      >
                        <activity.icon
                          className="w-4 h-4"
                          style={{ color: activity.color }}
                          aria-label={activity.action}
                        />
                      </div>
                    </div>

                    {/* Activity Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-medium text-sm text-[#E8E8F0]">{activity.company}</span>
                        <span className="text-sm text-[#6B7280] truncate">{activity.action}</span>
                      </div>
                    </div>

                    {/* Time badge */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="font-mono text-[10px] px-2 py-0.5 rounded-full text-[#6B7280]/70"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        {activity.time}
                      </span>
                      <div
                        className="w-1.5 h-1.5 rounded-full motion-safe:animate-pulse"
                        style={{ backgroundColor: activity.color }}
                      />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Live Indicator footer */}
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-[#6B7280]">
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inset-0 rounded-full bg-[#00FF88]"
                  style={{ animation: 'livePulse 1.5s ease-out infinite' }}
                />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF88]" />
              </span>
              <span className="font-mono text-[11px]">LIVE</span>
              <span className="text-[#6B7280]/30 mx-1">|</span>
              <span className="font-mono text-[11px]">9 agents online</span>
              <span className="text-[#6B7280]/30 mx-1">|</span>
              <span className="font-mono text-[11px]">Your server, your data</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
