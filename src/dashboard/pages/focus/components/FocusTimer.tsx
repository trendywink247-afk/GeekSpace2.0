import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/agentin';
import { Target, Pause } from 'lucide-react';
import type { FocusSession } from '../helpers';
const GR: Record<string,[string,string]> = { violet:['var(--ag-violet)','var(--ag-indigo)'], indigo:['var(--ag-indigo)','var(--ag-violet-soft)'], emerald:['var(--ag-emerald)','var(--ag-chartreuse)'], amber:['var(--ag-amber)','var(--ag-coral)'] };
const GL: Record<string,string> = { violet:'rgba(139,92,246,0.22)', indigo:'rgba(99,102,241,0.22)', emerald:'rgba(16,185,129,0.22)', amber:'rgba(245,158,11,0.22)' };
export interface TimerRingProps { progress:number; size?:number; strokeWidth?:number; children:React.ReactNode; accent?:'violet'|'indigo'|'emerald'|'amber'; }
export function TimerRing({ progress,size=240,strokeWidth=11,children,accent='violet' }:TimerRingProps) {
  const r=(size-strokeWidth*2)/2, circ=2*Math.PI*r, center=size/2, gid=`tring-${accent}-${size}`, [c1,c2]=GR[accent];
  return (
    <div className="relative flex items-center justify-center mx-auto" style={{width:size,height:size}}>
      <svg className="absolute inset-0" style={{transform:'rotate(-90deg)'}} viewBox={`0 0 ${size} ${size}`}>
        <defs><linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c2}/></linearGradient></defs>
        <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth={strokeWidth}/>
        {progress>0&&<circle cx={center} cy={center} r={r} fill="none" stroke={GL[accent]} strokeWidth={strokeWidth+8} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-progress/100)} opacity={0.32} style={{filter:'blur(8px)',transition:'stroke-dashoffset 1s linear'}}/>}
        <circle cx={center} cy={center} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-progress/100)} style={{transition:'stroke-dashoffset 1s linear'}}/>
      </svg>
      <div className="relative z-10 text-center">{children}</div>
    </div>
  );
}
export interface FocusTimerProps { session:FocusSession; progress:number; remaining:number|null; remainStr:string; elapsedStr:string; isLoading:boolean; onEnd:()=>Promise<void>; }
export function FocusTimer({ session,progress,remaining,remainStr,elapsedStr,isLoading,onEnd }:FocusTimerProps) {
  const near=remaining!==null&&remaining<60&&progress>5;
  return (
    <GlassCard accent="violet" className="p-6">
      <div className="space-y-5">
        <TimerRing progress={progress} size={240} strokeWidth={11} accent={near?'amber':'violet'}>
          <div>
            <motion.div className="text-4xl font-mono font-bold tracking-wider" style={{color:'var(--ag-text-primary)',fontVariantNumeric:'tabular-nums'}} animate={{opacity:[1,0.72,1]}} transition={{repeat:Infinity,duration:2,ease:'easeInOut'}}>
              {remaining!==null?remainStr:elapsedStr}
            </motion.div>
            <div className="text-xs mt-1.5 font-mono uppercase tracking-widest" style={{color:'var(--ag-text-muted)'}}>{remaining!==null?'remaining':'elapsed'}</div>
          </div>
        </TimerRing>
        {session.goal&&<p className="text-center text-sm flex items-center justify-center gap-1.5" style={{color:'var(--ag-text-secondary)'}}><Target size={13} style={{color:'var(--ag-violet-soft)'}}/><span className="truncate max-w-xs">{session.goal}</span></p>}
        <div className="text-center text-xs font-mono" style={{color:'var(--ag-text-muted)'}}>{session.duration_min?`${session.duration_min} min session`:'Open session'}</div>
        <motion.button onClick={()=>void onEnd()} disabled={isLoading} whileTap={{scale:0.96}} className="w-full h-14 px-8 rounded-xl text-white font-semibold flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 transition-all" style={{background:'linear-gradient(135deg,rgba(225,29,72,0.85),rgba(190,18,60,0.75))',boxShadow:'0 0 0 1px rgba(225,29,72,0.2),0 4px 12px rgba(225,29,72,0.18)'}}>
          <Pause size={18}/>End Session
        </motion.button>
      </div>
    </GlassCard>
  );
}
