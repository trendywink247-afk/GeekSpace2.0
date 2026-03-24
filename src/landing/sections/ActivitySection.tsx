import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Calendar, Send, CheckCircle, TrendingUp, Clock } from 'lucide-react';

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

const stats = [
  { label: 'completed', value: '5', icon: CheckCircle },
  { label: 'in progress', value: '3', icon: Clock },
];

export function ActivitySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [visibleActivities, setVisibleActivities] = useState<number[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible) {
      // Stagger in activities
      activities.forEach((_, i) => {
        setTimeout(() => {
          setVisibleActivities(prev => [...prev, i]);
        }, i * 100);
      });
    }
  }, [isVisible]);

  return (
    <section
      ref={sectionRef}
      id="activity"
      className="relative py-20 md:py-28 lg:py-32 overflow-hidden"
    >
      {/* Data River Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-full h-px neural-line"
            style={{
              top: `${15 + i * 10}%`,
              animation: `pulse 4s ease-in-out ${i * 0.5}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Left: Header & Stats */}
          <div 
            className={`lg:col-span-1 transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Your Agents, <span className="text-gradient">Always Working</span>
            </h2>
            <p className="text-lg text-[#6B7280] mb-8">
              While you focus on what matters, your AI team handles everything else -- around the clock, in parallel.
            </p>

            {/* Stats */}
            <div className="space-y-4">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="p-5 rounded-xl glass-card-v2 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center">
                      <stat.icon className="w-6 h-6 text-[#00F0FF]" />
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-[#E8E8F0]">{stat.value}</div>
                      <div className="text-sm text-[#6B7280]">{stat.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Activity Feed */}
          <div className="lg:col-span-2">
            <div className="space-y-3">
              {activities.map((activity, i) => (
                <div
                  key={activity.id}
                  className={`p-4 rounded-xl glass-card-v2 border border-[#00F0FF]/10 hover:border-[#00F0FF]/30 transition-all duration-500 flex items-center gap-4 ${
                    visibleActivities.includes(i)
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 translate-x-12'
                  }`}
                  style={{ transitionDelay: `${i * 50}ms` }}
                >
                  {/* Company Avatar */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${activity.color}20` }}
                  >
                    <activity.icon
                      className="w-5 h-5"
                      style={{ color: activity.color }}
                      aria-label={activity.action}
                    />
                  </div>

                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium text-[#E8E8F0]">{activity.company}</span>
                      <span className="text-[#6B7280]">{activity.action}</span>
                    </div>
                  </div>

                  {/* Time & Status */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm text-[#6B7280]/70 font-mono">{activity.time}</span>
                    <div
                      className="w-2 h-2 rounded-full motion-safe:animate-pulse"
                      style={{ backgroundColor: activity.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Live Indicator */}
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#6B7280]">
              <div className="w-2 h-2 bg-[#00FF88] rounded-full motion-safe:animate-pulse" />
              <span className="font-mono">LIVE</span>
              <span className="text-[#6B7280] mx-1">|</span>
              <span className="font-mono">Agent Activity</span>
              <span className="text-[#6B7280] mx-1">|</span>
              <span className="font-mono">9 agents online</span>
            </div>
            <div className="mt-3 text-center text-xs text-[#6B7280] font-mono">
              All systems healthy | 9 agents &middot; 24/7 uptime &middot; Your server, your data
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}