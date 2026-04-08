import { GlassCard, SectionHeader, Chip } from '@/components/ui/agentin';
import { ShieldOff } from 'lucide-react';
const DB=['Social feeds','News sites','Video streaming'];
export function BlockedDistractions({blockedSites}:{blockedSites?:string}){
  const sites=blockedSites?blockedSites.split(',').map((s)=>s.trim()).filter(Boolean):DB;
  return(
    <GlassCard className="p-5">
      <SectionHeader label="Blocked distractions" action={<ShieldOff size={13} style={{color:'var(--ag-text-muted)'}}/>} className="mb-3"/>
      <div className="flex flex-wrap gap-2">{sites.map((s)=><Chip key={s} accent="indigo">{s}</Chip>)}</div>
      <p className="text-xs mt-3" style={{color:'var(--ag-text-muted)'}}>Blocked during active focus sessions.</p>
    </GlassCard>
  );
}
