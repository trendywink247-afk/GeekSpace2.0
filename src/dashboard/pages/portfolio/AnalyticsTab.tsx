import { useState } from 'react';
import { Eye, TrendingUp, BarChart3, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/agentin';
import { portfolioService } from '@/services/api';

interface PortfolioStats {
  totalViews: number;
  recentViews: number;
  dailyBreakdown: { date: string; count: number }[];
}

interface AnalyticsTabProps {
  portfolioStats: PortfolioStats | null;
  showMessage: (type: 'success' | 'error', text: string) => void;
}

export function AnalyticsTab({ portfolioStats, showMessage }: AnalyticsTabProps) {
  const [analyticsFrom, setAnalyticsFrom] = useState('');
  const [analyticsTo, setAnalyticsTo] = useState('');

  const handleExportCsv = async () => {
    try {
      const response = await portfolioService.exportAnalyticsCSV(analyticsFrom || undefined, analyticsTo || undefined);
      const blob = new Blob([response.data as unknown as BlobPart], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showMessage('error', 'Failed to export CSV');
    }
  };

  return (
    <SectionCard title="Portfolio Analytics" subtitle="Track views and visitor insights">
      <div className="flex items-center gap-2 flex-wrap justify-end mb-4">
        <input
          type="date"
          value={analyticsFrom}
          onChange={(e) => setAnalyticsFrom(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] h-8 min-h-[44px]"
          aria-label="Analytics export from date"
        />
        <span className="text-xs text-[var(--ag-text-secondary)]">–</span>
        <input
          type="date"
          value={analyticsTo}
          onChange={(e) => setAnalyticsTo(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] h-8 min-h-[44px]"
          aria-label="Analytics export to date"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="border-[rgba(139,92,246,0.15)] text-[var(--ag-violet)] hover:bg-[#8B5CF6]/10 shrink-0 min-h-[44px]"
        >
          <Download className="w-4 h-4 mr-2" />Export CSV
        </Button>
      </div>

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-[var(--ag-bg-base)] shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_2px_8px_rgba(0,0,0,0.12)] transition-[box-shadow] duration-200 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.16),0_4px_16px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-[#EC4899]" />
              <span className="text-xs text-[var(--ag-text-muted)]">Total Views</span>
            </div>
            <div className="text-2xl font-bold text-[var(--ag-text-primary)] tabular-nums">
              {portfolioStats ? portfolioStats.totalViews.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-[var(--ag-text-muted)]">all time</div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--ag-bg-base)] shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_2px_8px_rgba(0,0,0,0.12)] transition-[box-shadow] duration-200 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.16),0_4px_16px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[#00FF88]" />
              <span className="text-xs text-[var(--ag-text-muted)]">Views This Week</span>
            </div>
            <div className="text-2xl font-bold text-[var(--ag-text-primary)] tabular-nums">
              {portfolioStats ? portfolioStats.recentViews.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-[#00FF88]">last 7 days</div>
            {portfolioStats && portfolioStats.dailyBreakdown.length > 0 && (
              <ResponsiveContainer width="100%" height={32} className="mt-2">
                <AreaChart data={portfolioStats.dailyBreakdown} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00FF88" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#00FF88" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="count" stroke="#00FF88" strokeWidth={1.5} fill="url(#sparkGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 30-day bar chart */}
        {portfolioStats && portfolioStats.dailyBreakdown.length > 0 ? (
          <div>
            <p className="text-xs text-[var(--ag-text-muted)] mb-3">Daily views — last 30 days</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={portfolioStats.dailyBreakdown} barSize={8}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  tick={{ fill: '#6B7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0C0C18', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--ag-text-muted)', fontSize: 11 }}
                  itemStyle={{ color: '#EC4899' }}
                />
                <Bar dataKey="count" fill="#EC4899" radius={[3, 3, 0, 0]} name="Views" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          portfolioStats && portfolioStats.totalViews === 0 ? (
            <div className="p-6 rounded-xl bg-[#EC4899]/5 border border-[rgba(139,92,246,0.08)] text-center">
              <BarChart3 className="w-12 h-12 text-[#EC4899]/50 mx-auto mb-3" />
              <h4 className="text-base font-medium text-[var(--ag-text-primary)] mb-1">No visits yet</h4>
              <p className="text-sm text-[var(--ag-text-muted)]">Share your portfolio link to start tracking visitors.</p>
            </div>
          ) : null
        )}
      </div>
    </SectionCard>
  );
}
