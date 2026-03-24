import { motion } from 'framer-motion';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

interface Activity {
  id: number;
  agent: string;
  action: string;
  time: string;
  color: string;
  status?: 'completed' | 'in-progress' | 'failed';
}

const activities: Activity[] = [
  { id: 1, agent: 'Cal', action: 'Reminder: Team standup in 15 minutes', time: 'now', color: '#4ECDC4', status: 'in-progress' },
  { id: 2, agent: 'Weebo', action: 'Answered 3 questions about GST filing', time: '2s ago', color: '#00F0FF', status: 'completed' },
  { id: 3, agent: 'Cal', action: 'Scheduled meeting with Rahul at 3 PM', time: '8s ago', color: '#4ECDC4', status: 'completed' },
  { id: 4, agent: 'Aria', action: 'Drafting social media banner copy', time: '12s ago', color: '#FF2D78', status: 'in-progress' },
  { id: 5, agent: 'Forge', action: 'Deployed REST API endpoint to production', time: '22s ago', color: '#FFB800', status: 'completed' },
  { id: 6, agent: 'Pulse', action: 'Analyzing Q1 revenue trends', time: '31s ago', color: '#00FF88', status: 'in-progress' },
  { id: 7, agent: 'Echo', action: 'Summarized 12 unread emails from clients', time: '45s ago', color: '#FF6B35', status: 'completed' },
  { id: 8, agent: 'Jarvis', action: 'Fixed TypeScript build error in auth module', time: '1m ago', color: '#ADFF2F', status: 'completed' },
  { id: 9, agent: 'Nova', action: 'Generating dashboard wireframes', time: '2m ago', color: '#E040FB', status: 'in-progress' },
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
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

const statusCounts = {
  completed: activities.filter(a => a.status === 'completed').length,
  inProgress: activities.filter(a => a.status === 'in-progress').length,
  failed: activities.filter(a => a.status === 'failed').length,
};

export function ActivitySection() {
  return (
    <section
      id="activity"
      className="relative overflow-hidden"
      style={{ padding: 'clamp(80px, 12vh, 160px) 0' }}
    >
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Centered section header */}
        <div className="text-center mb-14">
          <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#00F0FF]/70 mb-4 block">
            Real-Time Feed
          </span>
          <h2
            className="text-[clamp(2.25rem,3vw+0.5rem,3.5rem)] font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Your Agents, <span className="text-gradient">Always Working</span>
          </h2>
          <p className="text-lg text-[#94A3B8] max-w-2xl mx-auto">
            While you focus on what matters, your AI team handles everything else — around the clock, in parallel.
          </p>
        </div>

        {/* Feed container */}
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-[#0a0a18] border border-white/[0.06] overflow-hidden">
            {/* Feed header with live indicator */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <span className="text-sm font-medium text-[#E8E8F0]">Agent Activity</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="text-[11px] font-mono text-[#22c55e]/80 uppercase tracking-wider">Live</span>
              </div>
            </div>

            {/* Staggered activity items with top/bottom mask fade */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              style={{
                maskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)',
              }}
            >
              {activities.map((activity) => (
                <motion.div
                  key={activity.id}
                  variants={itemVariants}
                  className="flex gap-4 items-start px-5 py-4 border-b border-white/[0.04] last:border-b-0 transition-colors duration-200 hover:bg-white/[0.02]"
                >
                  {/* Colored dot */}
                  <div
                    className="w-2 h-2 rounded-full mt-2 shrink-0"
                    style={{ backgroundColor: activity.color }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#C8C8D8]">
                      <span className="font-medium text-[#E8E8F0]">{activity.agent}</span>
                      {' '}{activity.action}
                    </p>
                    <span className="text-xs text-[#6B7280] mt-1 block">{activity.time}</span>
                  </div>

                  {/* Status badge */}
                  {activity.status === 'completed' && (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400/60 mt-1 shrink-0" />
                  )}
                  {activity.status === 'in-progress' && (
                    <Clock className="w-3.5 h-3.5 text-amber-400/60 mt-1 shrink-0 animate-pulse" />
                  )}
                  {activity.status === 'failed' && (
                    <XCircle className="w-3.5 h-3.5 text-red-400/60 mt-1 shrink-0" />
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Status footer pills */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className="inline-flex items-center gap-1.5 text-xs bg-white/[0.03] border border-white/[0.06] px-3 py-1 rounded-full text-emerald-400/80">
              <CheckCircle className="w-3 h-3" />
              {statusCounts.completed} completed
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs bg-white/[0.03] border border-white/[0.06] px-3 py-1 rounded-full text-amber-400/80">
              <Clock className="w-3 h-3" />
              {statusCounts.inProgress} in progress
            </span>
            {statusCounts.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-white/[0.03] border border-white/[0.06] px-3 py-1 rounded-full text-red-400/60">
                <XCircle className="w-3 h-3" />
                {statusCounts.failed} failed
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
