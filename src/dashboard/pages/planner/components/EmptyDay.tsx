import { CalendarCheck, Plus } from 'lucide-react';
import { PillButton } from '@/components/ui/agentin';
interface EmptyDayProps { isToday: boolean; onAddBlock?: () => void; }
export function EmptyDay({ isToday, onAddBlock }: EmptyDayProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
        <CalendarCheck className="w-6 h-6" style={{ color: 'var(--ag-violet-soft)' }} />
      </div>
      <p className="text-sm font-semibold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ag-text-primary)' }}>
        {isToday ? 'Nothing scheduled yet' : 'Empty day'}
      </p>
      <p className="text-xs mb-5" style={{ color: 'var(--ag-text-muted)' }}>
        {isToday ? 'Drag items from the backlog or tap + to add a block' : 'No blocks planned for this day'}
      </p>
      {onAddBlock && <PillButton icon={Plus} accent="violet" onClick={onAddBlock}>Add a block</PillButton>}
    </div>
  );
}
