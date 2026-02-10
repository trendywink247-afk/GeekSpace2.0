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
  { id: 1, company: 'TechCorp', action: 'scheduled 12 meetings', icon: Calendar, time: '2s ago', color: '#7B61FF' },
  { id: 2, company: 'DesignStudio', action: 'sent 3 Telegram reminders', icon: Send, time: '5s ago', color: '#FF61DC' },
  { id: 3, company: 'ConsultX', action: 'updated portfolio pricing', icon: TrendingUp, time: '12s ago', color: '#61FF7B' },
  { id: 4, company: 'SupportAI', action: 'resolved a ticket in 18s', icon: CheckCircle, time: '18s ago', color: '#FFD761' },
  { id: 5, company: 'TechCorp', action: 'generated quarterly report', icon: MessageSquare, time: '34s ago', color: '#7B61FF' },
  { id: 6, company: 'SecureNet', action: 'blocked 247 threats', icon: CheckCircle, time: '45s ago', color: '#FF6161' },
  { id: 7, company: 'BuildCo', action: 'processed 89 invoices', icon: Clock, time: '1m ago', color: '#FFD761' },
  { id: 8, company: 'DesignStudio', action: 'delivered 5 design drafts', icon: MessageSquare, time: '2m ago', color: '#FF61DC' },
];

const stats = [
  { label: 'Messages', value: '2.4M+', icon: MessageSquare },
  { label: 'Uptime', value: '99.99%', icon: CheckCircle },
];

export function ActivitySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [visibleActivities, setVisibleActivities] = useState<number[]>([]);
  const [isPaused, setIsPaused] = useState(false);

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

  useEffect(() => {
    if (!isVisible || isPaused) return;

    const interval = setInterval(() => {
      setVisibleActivities((prev) => {
        if (prev.length === activities.length) return prev;
        return [...prev, prev.length];
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isVisible, isPaused]);

  return (
    <section
      ref={sectionRef}
      id="activity"
      className="relative py-24 overflow-hidden"
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

      <div className="relative z-10 max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Left: Header & Stats */}
          <div 
            className={`lg:col-span-1 transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <h2 
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Live <span className="text-gradient">Activity</span>
            </h2>
            <p className="text-lg text-[#A7ACB8] mb-8">
              See the network working in real time—reminders, messages, tasks, and automations.
            </p>

            {/* Stats */}
            <div className="space-y-4">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="p-5 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#7B61FF]/10 flex items-center justify-center">
                      <stat.icon className="w-6 h-6 text-[#7B61FF]" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-[#F4F6FF]">{stat.value}</div>
                      <div className="text-sm text-[#A7ACB8]">{stat.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Activity Feed */}
          <div className="lg:col-span-2">
            <div
              className="space-y-3"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              aria-live="polite"
            >
              {activities.map((activity, i) => (
                <div
                  key={activity.id}
                  className={`p-4 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/10 hover:border-[#7B61FF]/30 transition-all duration-500 flex items-center gap-4 ${
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
                    />
                  </div>

                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[#F4F6FF]">{activity.company}</span>
                      <span className="text-[#A7ACB8]">AI</span>
                      <span className="text-[#A7ACB8]">{activity.action}</span>
                    </div>
                  </div>

                  {/* Time & Status */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm text-[#A7ACB8]/70 font-mono">{activity.time}</span>
                    <div 
                      className={`w-2 h-2 rounded-full ${isPaused ? '' : 'animate-pulse'}`}
                      style={{ backgroundColor: activity.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Live Indicator */}
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#A7ACB8]">
              <div className={`w-2 h-2 bg-[#61FF7B] rounded-full ${isPaused ? '' : 'animate-pulse'}`} />
              <span className="font-mono">
                {isPaused ? 'Live feed paused while you inspect entries' : 'Live updates from the network'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
