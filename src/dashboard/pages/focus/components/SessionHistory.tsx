import { motion, type TargetAndTransition } from 'framer-motion';
import { GlassCard, SectionHeader, Chip } from '@/components/ui/agentin';
import { TrendingUp, Calendar } from 'lucide-react';
import { type FocusSession, formatDuration, formatRelativeDate, getDayLabel } from '../helpers';
function WeeklyFocusChart({ sessions }:{ sessions:FocusSession[] }) {
  const now=new Date(), dow=now.getDay(), mo=dow===0?6:dow-1, mon=new Date(now);
  mon.setDate(now.getDate()-mo); mon.setHours(0,0,0,0);
  const dm:number[]=Array(7).fill(0);
  for(const s of sessions){if(!s.ended_at||!s.duration_min)continue;const d=Math.floor((new Date(s.started_at).getTime()-mon.getTime())/86400000);if(d>=0&&d<7)dm[d]+=s.duration_min;}
  const mx=Math.max(...dm,30),bw=28,ch=100,gap=8,cw=bw*7+gap*6;
  return(
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${cw} ${ch+24}`} className="w-full max-w-[320px] mx-auto" preserveAspectRatio="xMidYMid meet">
        <defs><linearGradient id="hbg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="var(--ag-violet-soft)"/><stop offset="100%" stopColor="var(--ag-violet)"/></linearGradient></defs>
        {dm.map((mins,i)=>{const bH=(mins/mx)*ch,x=i*(bw+gap),y=ch-bH,it=i===mo;return(
          <g key={i}>
            <rect x={x} y={0} width={bw} height={ch} rx={6} fill="rgba(139,92,246,0.04)"/>
            {mins>0&&<><rect x={x} y={y} width={bw} height={Math.max(bH,4)} rx={6} fill={it?'url(#hbg)':'var(--ag-violet)'} opacity={it?1:0.4} style={{transition:'height .4s ease-out,y .4s ease-out'}}/><text x={x+bw/2} y={y-4} textAnchor="middle" fill="var(--ag-text-muted)" fontSize="9" fontFamily="monospace">{mins}m</text></>}
            <text x={x+bw/2} y={ch+16} textAnchor="middle" fill={it?'var(--ag-violet-soft)':'var(--ag-text-muted)'} fontSize="10" fontWeight={it?'bold':'normal'} fontFamily="inherit">{getDayLabel(i)}</text>
          </g>
        );})}
      </svg>
    </div>
  );
}
const SB='0 0 0 1px rgba(255,255,255,0.04),0 2px 8px rgba(0,0,0,0.28)',SH='0 0 0 1px rgba(139,92,246,0.18),0 6px 20px rgba(0,0,0,0.38)';
function SessionRow({session}:{session:FocusSession}){const done=Boolean(session.completed);return(
  <motion.div className="flex items-center justify-between py-2.5 px-3 rounded-xl backdrop-blur-xl" style={{background:'var(--ag-bg-surface)',boxShadow:SB,transition:'box-shadow var(--ag-transition-fast)'}} whileHover={{boxShadow:SH} as TargetAndTransition}>
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:done?'var(--ag-emerald)':'var(--ag-coral)'}}/>
      <div className="min-w-0"><p className="text-sm truncate" style={{color:'var(--ag-text-primary)'}}>{session.goal??'Focus session'}</p><p className="text-xs" style={{color:'var(--ag-text-muted)',fontVariantNumeric:'tabular-nums'}}>{formatRelativeDate(session.started_at)}</p></div>
    </div>
    <Chip accent={done?'emerald':'coral'} className="flex-shrink-0 ml-2">{session.duration_min?formatDuration(session.duration_min):'--'}</Chip>
  </motion.div>
);}
export interface SessionHistoryProps { history:FocusSession[]; completedHistory:FocusSession[]; }
export function SessionHistory({history,completedHistory}:SessionHistoryProps) {
  if(!completedHistory.length) return null;
  return(
    <div className="space-y-4">
      <GlassCard className="p-5"><SectionHeader label="This week" action={<TrendingUp size={13} style={{color:'var(--ag-violet-soft)'}}/>} className="mb-3"/><WeeklyFocusChart sessions={history}/></GlassCard>
      <div className="space-y-2">
        <SectionHeader label="Recent sessions" action={<Calendar size={13} style={{color:'var(--ag-text-muted)'}}/>}/>
        <div className="space-y-1.5">{completedHistory.slice(0,6).map((s,i)=>(<motion.div key={s.id} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.05,type:'spring',duration:0.35,bounce:0}}><SessionRow session={s}/></motion.div>))}</div>
      </div>
    </div>
  );
}
