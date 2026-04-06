import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { PROVIDER_COLORS_MAP, TOOLTIP_STYLE } from './helpers';

// ── Pie Legend ──────────────────────────────────────────────────

function PieLegend({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3">
      {data.map((entry) => {
        const pct = Math.round((entry.value / total) * 100);
        return (
          <div
            key={entry.name}
            className="flex items-center gap-1.5 text-xs text-[var(--ag-text-secondary)]"
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-inset ring-white/10"
              style={{ backgroundColor: PROVIDER_COLORS_MAP[entry.name] ?? '#6B7280' }}
            />
            <span>{entry.name}</span>
            <span className="text-[var(--ag-text-muted)] tabular-nums">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Delegation Legend ───────────────────────────────────────────

function DelegationLegend({
  data,
}: {
  data: { name: string; count: number; fill: string }[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-[var(--ag-border-subtle)]">
      {data.map((entry) => {
        const pct = Math.round((entry.count / total) * 100);
        return (
          <div
            key={entry.name}
            className="flex items-center gap-1.5 text-xs text-[var(--ag-text-secondary)]"
          >
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0 ring-1 ring-inset ring-white/10"
              style={{ backgroundColor: entry.fill }}
            />
            <span>{entry.name}</span>
            <span className="text-[var(--ag-text-muted)] tabular-nums">{entry.count}</span>
            <span className="text-[var(--ag-text-muted)] tabular-nums">({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Provider Pie Chart ──────────────────────────────────────────

export function ProviderPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={46}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              stroke="var(--ag-bg-base)"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={PROVIDER_COLORS_MAP[entry.name] ?? '#6B7280'}
                />
              ))}
            </Pie>
            <RechartsTooltip
              {...TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                <span key="val" className="tabular-nums">
                  {value}%
                </span>,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <PieLegend data={data} />
    </>
  );
}

// ── Delegation Bar Chart ────────────────────────────────────────

export function DelegationBarChart({
  data,
}: {
  data: { name: string; count: number; fill: string }[];
}) {
  return (
    <>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--ag-border-subtle)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--ag-text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--ag-text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip
              {...TOOLTIP_STYLE}
              formatter={(
                value: number,
                _name: string,
                props: { payload?: { name?: string } },
              ) => [
                <span key="val" className="tabular-nums">
                  {value} calls
                </span>,
                props.payload?.name ?? 'Agent',
              ]}
            />
            <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={40}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DelegationLegend data={data} />
    </>
  );
}
