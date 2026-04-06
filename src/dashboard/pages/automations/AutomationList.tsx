import { Search, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Automation, AutomationLog } from '@/types';
import { AutomationCard } from './AutomationCard';
import type { TestResult } from './helpers';

interface AutomationListProps {
  filtered: Automation[];
  searchQuery: string;
  filter: 'all' | 'active' | 'inactive';
  onSearchChange: (q: string) => void;
  onFilterChange: (f: 'all' | 'active' | 'inactive') => void;
  expandedRunHistory: string | null;
  runHistoryLogs: AutomationLog[];
  runHistoryLoading: boolean;
  testResult: TestResult | null;
  testingId: string | null;
  runningId: string | null;
  duplicatingId: string | null;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onRun: (id: string) => void;
  onTestFire: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleRunHistory: (id: string) => void;
  onOpenAdd: () => void;
}

export function AutomationList({
  filtered,
  searchQuery,
  filter,
  onSearchChange,
  onFilterChange,
  expandedRunHistory,
  runHistoryLogs,
  runHistoryLoading,
  testResult,
  testingId,
  runningId,
  duplicatingId,
  onToggle,
  onEdit,
  onDelete,
  onRun,
  onTestFire,
  onDuplicate,
  onToggleRunHistory,
  onOpenAdd,
}: AutomationListProps) {
  return (
    <>
      {/* Filters */}
      <BlurFade delay={0.5} inView>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted)]" />
            <Input
              placeholder="Search automations..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] h-11 text-base focus:border-[var(--ag-violet)]/50"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => onFilterChange(v as typeof filter)}>
            <TabsList className="bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] overflow-x-auto flex-nowrap w-auto">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-[var(--ag-violet)] data-[state=active]:text-white min-h-[44px] flex-none px-4"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className="data-[state=active]:bg-[var(--ag-success)] data-[state=active]:text-[var(--ag-bg-primary)] min-h-[44px] flex-none px-4"
              >
                Active
              </TabsTrigger>
              <TabsTrigger
                value="inactive"
                className="data-[state=active]:bg-[var(--ag-text-muted)] data-[state=active]:text-white min-h-[44px] flex-none px-4"
              >
                Paused
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </BlurFade>

      {/* Cards or empty state */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((auto, index) => (
            <AutomationCard
              key={auto.id}
              auto={auto}
              index={index}
              isExpanded={expandedRunHistory === auto.id}
              runHistoryLogs={expandedRunHistory === auto.id ? runHistoryLogs : []}
              runHistoryLoading={expandedRunHistory === auto.id ? runHistoryLoading : false}
              testResult={testResult}
              testingId={testingId}
              runningId={runningId}
              duplicatingId={duplicatingId}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onRun={onRun}
              onTestFire={onTestFire}
              onDuplicate={onDuplicate}
              onToggleRunHistory={onToggleRunHistory}
            />
          ))
        ) : (
          <BlurFade delay={0.7} inView>
            <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-[var(--ag-accent)]/5 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-[var(--ag-accent)]/30" />
                </div>
                <h3 className="text-[var(--ag-text-primary)] font-heading font-medium mb-1">
                  {searchQuery || filter !== 'all'
                    ? 'No automations match your filters'
                    : 'No automations yet'}
                </h3>
                <p className="text-sm text-[var(--ag-text-secondary)] mb-4 max-w-xs mx-auto">
                  {searchQuery || filter !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Create one from a template or build your own.'}
                </p>
                {!searchQuery && filter === 'all' && (
                  <Button
                    onClick={onOpenAdd}
                    className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-violet-soft)] hover:opacity-90 text-white min-h-[44px] transition-[transform,opacity] duration-150 active:scale-[0.96] shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Create Automation
                  </Button>
                )}
              </div>
            </SectionCard>
          </BlurFade>
        )}
      </div>
    </>
  );
}
