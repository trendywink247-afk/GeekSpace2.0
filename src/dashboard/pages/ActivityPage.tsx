import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Activity, Briefcase, Bell, Link2, Bot, Filter, Trash2, Download, Flame, Calendar, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { userService, activityService, type ActivityEntry } from '@/services/api';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';

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
  const category = getCategory(icon) as FilterType;
  const color = FILTER_COLORS[category] ?? '#6B7280';
  const Icon = FILTER_ICONS[category] ?? Activity;
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${color}15` }}
    >
      <Icon className="w-4 h-4" style={{ color }} />
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

// ── Heatmap helpers ──────────────────────────────────────────────

interface HeatmapDay {
  date: string;
  count: number;
  weekday: number; // 0=Mon .. 6=Sun
}

const HEATMAP_WEEKS = 13;
const DAY_LABELS_MAP: Record<number, string> = { 0: 'Mon', 2: 'Wed', 4: 'Fri' };

function getHeatmapColor(count: number): string {
  if (count === 0) return '#0C0C18';
  if (count <= 2) return 'rgba(0,240,255,0.2)';
  if (count <= 5) return 'rgba(0,240,255,0.4)';
  if (count <= 10) return 'rgba(0,240,255,0.6)';
  return '#00F0FF';
}

function buildHeatmapGrid(raw: Array<{ date: string; count: number }>): { grid: HeatmapDay[][]; monthLabels: Array<{ label: string; col: number }> } {
  const countMap = new Map<string, number>();
  for (const r of raw) countMap.set(r.date, r.count);

  const today = new Date();
  // Find the end of the current week (Sunday) so columns are full weeks
  const todayDay = today.getUTCDay(); // 0=Sun
  const endDate = new Date(today);
  // Move to end of current week (Sunday)
  endDate.setDate(endDate.getDate() + (todayDay === 0 ? 0 : 7 - todayDay));

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - HEATMAP_WEEKS * 7 + 1);

  const grid: HeatmapDay[][] = [];
  const monthLabels: Array<{ label: string; col: number }> = [];
  let lastMonth = -1;

  const cursor = new Date(startDate);
  let col = 0;
  let currentWeek: HeatmapDay[] = [];

  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dow = cursor.getUTCDay();
    const weekday = dow === 0 ? 6 : dow - 1; // Mon=0..Sun=6

    // Track month transitions for labels
    const month = cursor.getUTCMonth();
    if (month !== lastMonth) {
      const monthName = cursor.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      monthLabels.push({ label: monthName, col });
      lastMonth = month;
    }

    const isFuture = cursor > today;
    currentWeek.push({
      date: dateStr,
      count: isFuture ? 0 : (countMap.get(dateStr) ?? 0),
      weekday,
    });

    // If this is Sunday (weekday 6) or last day, push the week
    if (weekday === 6) {
      grid.push(currentWeek);
      currentWeek = [];
      col++;
    }

    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) {
    grid.push(currentWeek);
  }

  return { grid, monthLabels };
}

function ActivityHeatmap({ data }: { data: Array<{ date: string; count: number }> }) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { grid, monthLabels } = useMemo(() => buildHeatmapGrid(data), [data]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>, day: HeatmapDay) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top - 30;
    const label = day.count === 1 ? '1 event' : `${day.count} events`;
    setTooltip({ text: `${label} on ${day.date}`, x, y });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const totalEvents = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  return (
    <Card className="border-[#00F0FF]/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-sm font-medium text-[#E8E8F0]">Activity Heatmap</span>
            <span className="text-xs text-[#9CA3AF]">last 90 days</span>
          </div>
          <span className="text-xs text-[#9CA3AF]">{totalEvents} total events</span>
        </div>

        {/* Scrollable container for mobile */}
        <div className="overflow-x-auto -mx-1 px-1" ref={containerRef}>
          <div className="min-w-[420px] relative">
            {/* Month labels */}
            <div className="flex ml-8 mb-1 h-4">
              {monthLabels.map((m, i) => (
                <span
                  key={`${m.label}-${i}`}
                  className="text-[10px] text-[#9CA3AF] absolute"
                  style={{ left: `${32 + m.col * 15}px` }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Grid: rows = days (Mon-Sun), cols = weeks */}
            <div className="flex gap-[1px]">
              {/* Day labels */}
              <div className="flex flex-col gap-[1px] mr-1 flex-shrink-0" style={{ width: '24px' }}>
                {Array.from({ length: 7 }).map((_, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="h-[13px] flex items-center justify-end pr-1"
                  >
                    {DAY_LABELS_MAP[dayIdx] != null && (
                      <span className="text-[9px] text-[#9CA3AF] leading-none">{DAY_LABELS_MAP[dayIdx]}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              {grid.map((week, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-[1px]">
                  {/* Pad the start of the first column if it doesn't start on Monday */}
                  {colIdx === 0 && week[0] && week[0].weekday > 0 &&
                    Array.from({ length: week[0].weekday }).map((_, i) => (
                      <div key={`pad-${i}`} className="w-[13px] h-[13px]" />
                    ))
                  }
                  {week.map((day) => (
                    <div
                      key={day.date}
                      className="w-[13px] h-[13px] rounded-[2px] cursor-pointer transition-all hover:ring-1 hover:ring-[#00F0FF]/50"
                      style={{ backgroundColor: getHeatmapColor(day.count) }}
                      onMouseEnter={(e) => handleMouseEnter(e, day)}
                      onMouseLeave={handleMouseLeave}
                      title={`${day.count} events on ${day.date}`}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Color legend */}
            <div className="flex items-center gap-1.5 mt-2 justify-end">
              <span className="text-[9px] text-[#9CA3AF]">Less</span>
              {[0, 1, 3, 6, 11].map((threshold) => (
                <div
                  key={threshold}
                  className="w-[10px] h-[10px] rounded-[2px]"
                  style={{ backgroundColor: getHeatmapColor(threshold) }}
                />
              ))}
              <span className="text-[9px] text-[#9CA3AF]">More</span>
            </div>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute pointer-events-none z-50 px-2 py-1 rounded-md text-xs text-[#E8E8F0] bg-[#12121F] border border-[#00F0FF]/20 shadow-lg whitespace-nowrap"
                style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%)' }}
              >
                {tooltip.text}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Stats Bar ────────────────────────────────────────────────────

interface ActivityStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
}

function computeActivityStats(entries: ActivityEntry[], serverTotal: number): ActivityStats {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Get start of this week (Monday)
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - mondayOffset);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  // Get start of this month
  const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  let today = 0;
  let thisWeek = 0;
  let thisMonth = 0;

  for (const entry of entries) {
    const ts = typeof entry.created_at === 'string'
      ? (entry.created_at.includes('T') ? entry.created_at : entry.created_at.replace(' ', 'T') + 'Z')
      : new Date(entry.created_at).toISOString();
    const dateStr = ts.slice(0, 10);

    if (dateStr === todayStr) today++;
    if (dateStr >= weekStartStr) thisWeek++;
    if (dateStr >= monthStartStr) thisMonth++;
  }

  return { today, thisWeek, thisMonth, total: serverTotal };
}

function StatsBar({ stats }: { stats: ActivityStats }) {
  const items = [
    { label: 'Today', value: stats.today, icon: Flame },
    { label: 'This week', value: stats.thisWeek, icon: Calendar },
    { label: 'This month', value: stats.thisMonth, icon: BarChart3 },
    { label: 'Total', value: stats.total, icon: Activity },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {items.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/10"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#00F0FF]/10 flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-[#00F0FF]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#E8E8F0] tabular-nums">{value.toLocaleString()}</div>
            <div className="text-[10px] text-[#9CA3AF] leading-none">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

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
  // GAP-8: Heatmap data
  const [heatmapData, setHeatmapData] = useState<Array<{ date: string; count: number }>>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  // GAP-8: Fetch heatmap data once on mount
  useEffect(() => {
    setHeatmapLoading(true);
    activityService.getHeatmap()
      .then(({ data }) => setHeatmapData(data.heatmap ?? []))
      .catch(() => setHeatmapData([]))
      .finally(() => setHeatmapLoading(false));
  }, []);

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
      const today = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentin-activity-${today}.csv`;
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

  // GAP-8: Compute stats from loaded entries
  const stats = useMemo(() => computeActivityStats(entries, total), [entries, total]);

  const handlePullRefresh = async () => {
    const res = await userService.getActivity(50);
    setEntries(res.data.activity ?? []);
    setTotal(res.data.total ?? res.data.activity?.length ?? 0);
  };

  return (
    <PullToRefreshWrapper onRefresh={handlePullRefresh}>
    <div data-testid="activity-page" className="space-y-4 md:space-y-6 animate-in fade-in duration-500 px-1 md:px-0 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-4xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>Activity Log</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF]">Tracked by Pulse</span>
          </div>
          <p className="text-sm md:text-base text-[#9CA3AF]">
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
                <button onClick={() => setShowClearConfirm(false)} className="text-xs text-[#9CA3AF] hover:text-[#E8E8F0]">Cancel</button>
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

      {/* GAP-8: Stats Bar */}
      <StatsBar stats={stats} />

      {/* GAP-8: Activity Heatmap */}
      {heatmapLoading ? (
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded bg-[#1a1a2e] animate-pulse" />
              <div className="h-4 w-32 rounded bg-[#1a1a2e] animate-pulse" />
            </div>
            <div className="flex gap-[1px] ml-8">
              {Array.from({ length: 13 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-[1px]">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div key={j} className="w-[13px] h-[13px] rounded-[2px] bg-[#1a1a2e] animate-pulse" />
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <ActivityHeatmap data={heatmapData} />
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
        <Input
          placeholder="Search by action or details..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#0C0C18] border-[#00F0FF]/30 text-[#E8E8F0] min-h-[44px]"
        />
      </div>

      {/* 65.9: Date-range filter */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#9CA3AF]">
        <span>From:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-[#E8E8F0] text-xs min-h-[44px]"
          aria-label="Filter from date"
        />
        <span>To:</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-[#E8E8F0] text-xs min-h-[44px]"
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
        <Filter className="w-4 h-4 text-[#9CA3AF] self-center flex-shrink-0" />
        {FILTER_CHIPS.map((chip) => {
          const Icon = FILTER_ICONS[chip];
          const color = FILTER_COLORS[chip];
          const isActive = activeFilter === chip;
          return (
            <button
              key={chip}
              onClick={() => setActiveFilter(chip)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[44px] border ${
                isActive
                  ? 'border-current'
                  : 'border-[#00F0FF]/20 text-[#9CA3AF] hover:border-[#00F0FF]/40'
              }`}
              style={isActive ? { color, backgroundColor: `${color}15`, borderColor: `${color}60` } : {}}
            >
              <Icon className="w-3 h-3" />
              {chip}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${isActive ? 'bg-current/10' : 'bg-[#0C0C18]'}`}
                style={isActive ? { color } : {}}>
                {counts[chip]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 66.7: Category color legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#9CA3AF]">
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
              <div className="w-16 h-16 rounded-2xl bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-[#00F0FF]/40" />
              </div>
              <p className="text-[#E8E8F0] font-medium mb-1">
                {serverQ || activeFilter !== 'All'
                  ? 'No events match your filters'
                  : 'No activity yet'}
              </p>
              <p className="text-sm text-[#9CA3AF]">
                {serverQ || activeFilter !== 'All'
                  ? 'Try adjusting your search or filters'
                  : 'Every action you take — chats, reminders, habits, integrations — is tracked here so you can review what your AI has been doing for you'}
              </p>
              {(serverQ || activeFilter !== 'All') && (
                <button
                  onClick={() => { setSearchQuery(''); setActiveFilter('All'); }}
                  className="text-xs text-[#00F0FF] hover:underline mt-3"
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
                      <p className="text-xs text-[#9CA3AF] truncate mt-0.5">{entry.details}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right flex items-start gap-2">
                    <div>
                      <span title={new Date(parseSqliteTs(entry.created_at)).toLocaleString()} className="text-xs text-[#8888AA] whitespace-nowrap">
                        {timeAgo(entry.created_at)}
                      </span>
                      <p className="text-xs text-[#9CA3AF]/60 mt-0.5">
                        {getCategory(entry.icon)}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await userService.deleteActivityEntry(entry.id).catch(() => {});
                        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
                      }}
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded text-[#9CA3AF] hover:text-[#FF6161] transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#00F0FF]/30 text-[#00F0FF] text-sm hover:bg-[#00F0FF]/10 disabled:opacity-50 transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
          >
            {loadingMore ? (
              <div className="w-4 h-4 border-2 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin" />
            ) : null}
            {loadingMore ? 'Loading…' : `Load more (${total - entries.length} remaining)`}
          </button>
        </div>
      )}
      {filtered.length > 0 && (
        <p className="text-xs text-[#9CA3AF] text-center">
          Showing {filtered.length} of {total} events
        </p>
      )}
    </div>
    </PullToRefreshWrapper>
  );
}
