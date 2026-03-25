import { Zap, Shield, MessageSquare, Users } from 'lucide-react';
import { Marquee } from '@/components/magicui/marquee';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { BlurFade } from '@/components/magicui/blur-fade';

const stats = [
  { icon: Users, value: 100, suffix: '+', label: 'professionals' },
  { icon: Zap, value: 5000, suffix: '+', label: 'tasks daily' },
  { icon: Shield, value: 99.9, suffix: '%', label: 'uptime', decimals: 1 },
  { icon: MessageSquare, value: 9, suffix: '', label: 'AI agents' },
];

const activities = [
  { agent: 'Cal', action: 'Scheduled standup', color: '#4ECDC4' },
  { agent: 'Weebo', action: 'Answered GST query', color: '#10B981' },
  { agent: 'Aria', action: 'Drafted social copy', color: '#8B5CF6' },
  { agent: 'Forge', action: 'Deployed API endpoint', color: '#FFB800' },
  { agent: 'Pulse', action: 'Analyzing revenue', color: '#10B981' },
  { agent: 'Echo', action: 'Summarized 12 emails', color: '#FF6B35' },
  { agent: 'Jarvis', action: 'Fixed build error', color: '#10B981' },
  { agent: 'Nova', action: 'Generated wireframes', color: '#E040FB' },
  { agent: 'Edith', action: 'Researching market trends', color: '#8B5CF6' },
];

function ActivityPill({ activity }: { activity: typeof activities[number] }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02] whitespace-nowrap">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activity.color }} />
      <span className="text-xs font-medium text-white/80">{activity.agent}</span>
      <span className="text-xs text-white/60">{activity.action}</span>
    </div>
  );
}

export function SocialProofSection() {
  return (
    <section className="relative border-t border-b border-white/[0.04]">
      {/* Row 1: Stats bar */}
      <BlurFade delay={0.1}>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 py-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2">
              <stat.icon className="w-4 h-4 text-[#8B5CF6]" />
              <NumberTicker
                value={stat.value}
                suffix={stat.suffix}
                decimalPlaces={stat.decimals ?? 0}
                className="text-sm font-bold text-white/90 font-mono"
              />
              <span className="text-xs text-white/60">{stat.label}</span>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* Divider between rows */}
      <div className="border-t border-white/[0.04]" />

      {/* Row 2: Marquee activity feed */}
      <BlurFade delay={0.2}>
        <div
          className="py-4 overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
          }}
        >
          <Marquee speed={30} pauseOnHover>
            {activities.map((activity) => (
              <ActivityPill key={activity.agent} activity={activity} />
            ))}
          </Marquee>
        </div>
      </BlurFade>
    </section>
  );
}
