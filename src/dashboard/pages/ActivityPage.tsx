import { useState, useEffect, useRef } from 'react';
import { Search, Activity, Briefcase, Bell, Link2, Bot, Filter, Trash2, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { userService, activityService, type ActivityEntry } from '@/services/api';

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

// 48.5: Normalize SQLite timestamp strings to ISO-8601 UTC before parsing.
// SQLite returns "YYYY-MM-DD HH:MM:SS" (space, no Z) which V8 treats as local time;
// Safari fails entirely. Normalizing to "YYYY-MM-DDTHH:MM:SSZ" ensures correct UTC parse.
function parseSqliteTs(ts: string | number): number {
  if (typeof ts === 'number') return ts;
  const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  return new Date(normalized).getTime();
}

function timeAgo(ts: string | number): string {
  const ms = parseSqliteTs(ts);
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'yesterday';
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  // Use toLocaleDateString so the fallback label reflects the user's timezone (48.5)
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// 46.8: Reduced from 50 to 25 to match server default and lower initial payload
const PAGE_SIZE = 25;

export function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // 64.3: server-side search — debounced from searchQuery
  const [serverQ, setServerQ] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  // 40.4: Clear all with confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  // 64.8: CSV export
  const [exporting, setExporting] = useState(false);
  // 65.9: Date-range filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounce search query → serverQ
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setServerQ(searchQuery); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // Reload when serverQ or date-range changes (server-side text search + date filter)
  useEffect(() => {
    setLoading(true);
    userService.getActivity(PAGE_SIZE, 0, serverQ || undefined, undefined, dateFrom || undefined, dateTo || undefined)
      .then(({ data }) => { setEntries(data.activity); setTotal(data.total ?? data.activity.length); })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [serverQ, dateFrom, dateTo]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    userService.getActivity(PAGE_SIZE, entries.length, serverQ || undefined, undefined, dateFrom || undefined, dateTo || undefined)
      .then(({ data }) => { setEntries((prev) => [...prev, ...data.activity]); setTotal(data.total ?? (entries.length + data.activity.length)); })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  // 64.8: Download activity log as CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await activityService.export();
      const url = URL.createObjectURL(res.data as unknown as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'activity-log.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* non-fatal */ } finally {
      setExporting(false);
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await userService.clearActivity();
      setEntries([]);
      setTotal(0);
      setShowClearConfirm(false);
    } catch { /* ignore */ } finally {
      setIsClearing(false);
    }
  };

  // 64.3: text search is server-side; client-side only filters by category chip
  const filtered = entries.filter((entry) => {
    const matchesFilter = activeFilter === 'All' || getCategory(entry.icon) === activeFilter;
    return matchesFilter;
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
    <div data-testid="activity-page" className="space-y-4 md:space-y-6 animate-in fade-in duration-500 px-1 md:px-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Activity Log
          </h1>
          <p className="text-sm md:text-base text-[#6B7280]">
            <span className="text-[#00F0FF] font-medium">{total || entries.length}</span> total events recorded
          </p>
        </div>
        {/* 40.4: Clear all + 64.8: Export */}
        {entries.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 64.8: CSV export button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="h-8 border-[#00F0FF]/30 text-[#00F0FF]/70 hover:text-[#00F0FF] hover:border-[#00F0FF]/50"
            >
              <Download className="w-3 h-3 mr-1" />{exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            {showClearConfirm ? (
              <>
                <span className="text-xs text-[#FF6161]">Clear all activity?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className="h-8 bg-[#FF6161]/20 border border-[#FF6161]/40 text-[#FF6161] hover:bg-[#FF6161]/30"
                >
                  {isClearing ? 'Clearing…' : 'Yes, clear'}
                </Button>
                <button onClick={() => setShowClearConfirm(false)} className="text-xs text-[#6B7280] hover:text-[#E8E8F0]">Cancel</button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowClearConfirm(true)}
                className="h-8 border-[#FF6161]/30 text-[#FF6161]/70 hover:text-[#FF6161] hover:border-[#FF6161]/50"
              >
                <Trash2 className="w-3 h-3 mr-1" />Clear all
              </Button>
            )}
          </div>
        )}
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

      {/* 65.9: Date-range filter */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
        <span>From:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-[#E8E8F0] text-xs"
          aria-label="Filter from date"
        />
        <span>To:</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-[#E8E8F0] text-xs"
          aria-label="Filter to date"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-[#FF6161] hover:text-[#FF6161]/80 transition-colors"
            aria-label="Clear date range"
          >
            ✕ Clear dates
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div data-testid="filter-chips" className="flex gap-2 flex-wrap">
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

      {/* 66.7: Category color legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#6B7280]">
        <span className="font-medium">Legend:</span>
        {(Object.entries(FILTER_COLORS) as Array<[FilterType, string]>).filter(([k]) => k !== 'All').map(([cat, color]) => (
          <span key={cat} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            {cat}
          </span>
        ))}
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
                {serverQ || activeFilter !== 'All'
                  ? 'No events match your filters'
                  : 'No activity recorded yet'}
              </p>
              {(serverQ || activeFilter !== 'All') && (
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
                  className="group flex items-start gap-3 px-4 py-3 hover:bg-[#00F0FF]/5 transition-colors"
                >
                  <ActivityIcon icon={entry.icon} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E8E8F0] truncate">{entry.action}</p>
                    {entry.details && (
                      <p className="text-xs text-[#6B7280] truncate mt-0.5">{entry.details}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right flex items-start gap-2">
                    <div>
                      <span title={new Date(parseSqliteTs(entry.created_at)).toLocaleString()} className="text-xs text-[#8888AA] whitespace-nowrap">
                        {timeAgo(entry.created_at)}
                      </span>
                      <p className="text-[10px] text-[#6B7280]/60 mt-0.5">
                        {getCategory(entry.icon)}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await userService.deleteActivityEntry(entry.id).catch(() => {});
                        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#6B7280] hover:text-[#FF6161] transition-all"
                      aria-label="Delete this entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {entries.length > 0 && entries.length < total && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#00F0FF]/30 text-[#00F0FF] text-sm hover:bg-[#00F0FF]/10 disabled:opacity-50 transition-colors"
          >
            {loadingMore ? (
              <div className="w-4 h-4 border-2 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin" />
            ) : null}
            {loadingMore ? 'Loading…' : `Load more (${total - entries.length} remaining)`}
          </button>
        </div>
      )}
      {filtered.length > 0 && (
        <p className="text-xs text-[#6B7280] text-center">
          Showing {filtered.length} of {total} events
        </p>
      )}
    </div>
  );
}
