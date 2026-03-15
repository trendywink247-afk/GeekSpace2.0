import { useMobileDetect } from '@/hooks/useMobileDetect';
import { type ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  primary?: boolean;
  hideOnMobile?: boolean;
}

interface MobileTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  striped?: boolean;
}

export function MobileTable<T>({ columns, data, keyExtractor, emptyMessage = 'No data', striped = false }: MobileTableProps<T>) {
  const isMobile = useMobileDetect();

  if (data.length === 0) {
    return <div className="text-center text-muted-foreground py-8">{emptyMessage}</div>;
  }

  if (isMobile) {
    const visibleCols = columns.filter(c => !c.hideOnMobile);
    const primaryCol = visibleCols.find(c => c.primary) || visibleCols[0];
    const secondaryCols = visibleCols.filter(c => c !== primaryCol);

    return (
      <div className="space-y-3">
        {data.map(row => (
          <div key={keyExtractor(row)} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="font-medium text-sm">{primaryCol.render(row)}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {secondaryCols.map(col => (
                <div key={col.key}>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{col.label}</span>
                  <div className="text-sm">{col.render(row)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {columns.map(col => (
              <th key={col.key} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={keyExtractor(row)}
              className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                striped && idx % 2 === 1 ? 'bg-[#0C0C18]/60' : ''
              }`}
            >
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3">{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
