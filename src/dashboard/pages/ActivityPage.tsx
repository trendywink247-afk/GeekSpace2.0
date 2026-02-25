import { useState, useEffect } from 'react';
import { Search, Activity, Briefcase, Bell, Link2, Bot, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { userService, type ActivityEntry } from '@/services/api';

// Map icon field values to event categories
function getCategory(icon: string): string {
  if (['briefcase', 'portfolio', 'image', 'code', 'file'].includes(icon)) return 'Portfolio';
  if (['bell', 'clock', 'alarm', 'reminder'].includes(icon)) return 'Reminders';
  if (['link', 'link2', 'webhook', 'zap', 'automation'].includes(icon)) return 'Integrations';
  if (['bot', 'brain', 'cpu', 'sparkles', 'message'].includes(icon)) return 'Agent';
  return 'Other';
}

type FilterType = 'All' | 'Portfolio' | 'Reminders' | 'Integrations' | 'Agent';

const FILTER_CHIPS: FilterType[] = ['All', 'Portfolio', 'Reminders', 'Integrations', 'Agent'];

const FILTER_ICONS: Record<FilterType, typeof Activity> = {
  All: Activity,
  Portfolio: Briefcase,
  Reminders: Bell,
  Integrations: Link2,
  Agent: Bot,
};

const FILTER_COLORS: Record<FilterType, string> = {
  All: '#00F0FF',
  Portfolio: '#BF5FFF',
  Reminders: '#F59E0B',
  Integrations: '#00FF88',
  Agent: '#EC4899',
};

function ActivityIcon({ icon }: { icon: string }) {
  const category = getCategory(icon);
  const color = FILTER_COLORS[category as FilterType] ?? '#6B7280';
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${color}15` }}
    >
      <Activity className="w-4 h-4" style={{ color }} />
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');

  useEffect(() => {
    setLoading(true);
    userService.getActivity(200)
      .then(({ data }) => setEntries(data.activity))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter((entry) => {
    const matchesSearch =
      !searchQuery ||
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.details.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      activeFilter === 'All' || getCategory(entry.icon) === activeFilter;

    return matchesSearch && matchesFilter;
  });

  // Count per category for badge display
  const counts: Record<FilterType, number> = {
    All: entries.length,
    Portfolio: entries.filter((e) => getCategory(e.icon) === 'Portfolio').length,
    Reminders: entries.filter((e) => getCategory(e.icon) === 'Reminders').length,
    Integrations: entries.filter((e) => getCategory(e.icon) === 'Integrations').length,
    Agent: entries.filter((e) => getCategory(e.icon) === 'Agent').length,
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 px-1 md:px-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Activity Log
        </h1>
        <p className="text-sm md:text-base text-[#6B7280]">
          <span className="text-[#00F0FF] font-medium">{entries.length}</span> total events recorded
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
        <Input
          placeholder="Search by action or details..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#0C0C18] border-[#00F0FF]/30 text-[#E8E8F0] min-h-[44px]"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-[#6B7280] self-center flex-shrink-0" />
        {FILTER_CHIPS.map((chip) => {
          const Icon = FILTER_ICONS[chip];
          const color = FILTER_COLORS[chip];
          const isActive = activeFilter === chip;
          return (
            <button
              key={chip}
              onClick={() => setActiveFilter(chip)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[36px] border ${
                isActive
                  ? 'border-current'
                  : 'border-[#00F0FF]/20 text-[#6B7280] hover:border-[#00F0FF]/40'
              }`}
              style={isActive ? { color, backgroundColor: `${color}15`, borderColor: `${color}60` } : {}}
            >
              <Icon className="w-3 h-3" />
              {chip}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-current/10' : 'bg-[#0C0C18]'}`}
                style={isActive ? { color } : {}}>
                {counts[chip]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Activity list */}
      <Card className="border-[#00F0FF]/20">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="w-12 h-12 text-[#00F0FF]/20 mx-auto mb-4" />
              <p className="text-[#6B7280] mb-1">
                {searchQuery || activeFilter !== 'All'
                  ? 'No events match your filters'
                  : 'No activity recorded yet'}
              </p>
              {(searchQuery || activeFilter !== 'All') && (
                <button
                  onClick={() => { setSearchQuery(''); setActiveFilter('All'); }}
                  className="text-xs text-[#00F0FF] hover:underline mt-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#00F0FF]/10">
              {filtered.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-[#00F0FF]/5 transition-colors"
                >
                  <ActivityIcon icon={entry.icon} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E8E8F0] truncate">{entry.action}</p>
                    {entry.details && (
                      <p className="text-xs text-[#6B7280] truncate mt-0.5">{entry.details}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-[10px] text-[#6B7280] font-mono whitespace-nowrap">
                      {timeAgo(entry.created_at)}
                    </span>
                    <p className="text-[10px] text-[#6B7280]/60 mt-0.5">
                      {getCategory(entry.icon)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <p className="text-xs text-[#6B7280] text-center">
          Showing {filtered.length} of {entries.length} events
        </p>
      )}
    </div>
  );
}
