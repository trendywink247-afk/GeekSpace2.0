// FocusPage (revamped) — Agentin Aurora, mobile-first
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell, DashboardPageWrapper, PageHeader } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { GlassCard, StatCard } from '@/components/ui/agentin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { toast } from 'sonner';
import { Target, Bell, BellOff, Flame, Timer, Clock, CheckCircle } from 'lucide-react';
import { useFocusSession } from './hooks/useFocusSession';
import { useFocusHistory } from './hooks/useFocusHistory';
import { FocusTimer } from './components/FocusTimer';
import { SessionStarter } from './components/SessionStarter';
import { SessionHistory } from './components/SessionHistory';
import { BlockedDistractions } from './components/BlockedDistractions';
import { BreakReminder } from './components/BreakReminder';
import { EmptyFocus } from './components/EmptyFocus';
import { HabitsTab } from './HabitsTab';
import { StartSessionModal } from './StartSessionModal';
import { AddHabitDialog } from './AddHabitDialog';
import type { Habit } from './helpers';
import { formatDuration } from './helpers';

function CelebrationPulse(){return(
  <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
    <div className="w-64 h-64 rounded-full animate-ping" style={{background:'rgba(16,185,129,0.07)'}}/>
    <div className="absolute w-48 h-48 rounded-full animate-ping" style={{background:'rgba(167,139,250,0.07)',animationDelay:'0.15s'}}/>
    <div className="absolute w-32 h-32 rounded-full animate-ping" style={{background:'rgba(251,146,60,0.07)',animationDelay:'0.3s'}}/>
  </div>
);}

export function FocusPage(){
  const {session,settings,deferredCount,isLoading,remaining,progress,elapsedStr,remainStr,start,end,toggleFocusMode,loadSession}=useFocusSession();
  const {history,summary,completedHistory,focusStreak,loadHistory}=useFocusHistory();
  const [habits,setHabits]=useState<Habit[]>([]);
  const [deletingHabitId,setDeletingHabitId]=useState<number|null>(null);
  const [activeTab,setActiveTab]=useState('focus');
  const [showStartModal,setShowStartModal]=useState(false);
  const [showAddHabit,setShowAddHabit]=useState(false);
  const [goalInput,setGoalInput]=useState('');
  const [durInput,setDurInput]=useState(25);
  const [habitLoading,setHabitLoading]=useState(false);
  const [newHabitName,setNewHabitName]=useState('');
  const [newHabitIcon,setNewHabitIcon]=useState('⭐');
  const [newHabitFreq,setNewHabitFreq]=useState('daily');
  const [initialLoading,setInitialLoading]=useState(true);
  const [showBreakSuggestion,setShowBreakSuggestion]=useState(false);
  const [showCelebration,setShowCelebration]=useState(false);
  const load=useCallback(async()=>{
    try{const[hR]=await Promise.all([api.get('/habits'),loadSession(),loadHistory()]);setHabits((hR.data as{habits:Habit[]}).habits);}
    catch{toast.error('Failed to load focus data');}
    finally{setInitialLoading(false);}
  },[loadSession,loadHistory]);
  useEffect(()=>{void load();},[load]);
  const prevRem=useRef<number|null>(null);
  useEffect(()=>{
    if(prevRem.current!==null&&prevRem.current>0&&remaining===0&&session){
      if('Notification'in window&&Notification.permission==='granted')new Notification('Focus Session Complete!',{body:`Great work! You focused for ${session.duration_min??0} minutes.`,icon:'/favicon.ico'});
      void end(true);setShowBreakSuggestion(true);
    }
    prevRem.current=remaining;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[remaining]);
  async function handleStartFocus(){await start(goalInput||null,durInput);setShowStartModal(false);setGoalInput('');setShowBreakSuggestion(false);}
  async function handleLogHabit(id:number){
    try{
      await api.post('/habits/'+id+'/log',{});
      setHabits((prev)=>{const upd=prev.map((h)=>h.id===id?{...h,logged_today:true,current_streak:h.current_streak+1}:h);if(upd.length>0&&upd.every((h)=>h.logged_today)){setShowCelebration(true);setTimeout(()=>setShowCelebration(false),2000);}return upd;});
      toast.success('Habit logged');setTimeout(()=>void load(),600);
    }catch{toast.error('Failed to log habit');}
  }
  async function handleAddHabit(){
    if(!newHabitName.trim())return;setHabitLoading(true);
    try{await api.post('/habits',{name:newHabitName.trim(),icon:newHabitIcon,frequency:newHabitFreq});setNewHabitName('');setNewHabitIcon('⭐');setNewHabitFreq('daily');setShowAddHabit(false);void load();toast.success('Habit added');}
    catch{toast.error('Failed to add habit');}
    setHabitLoading(false);
  }
  async function handleDeleteHabit(id:number){
    setDeletingHabitId(id);
    try{await api.delete('/habits/'+id);void load();toast.success('Habit deleted');}catch{toast.error('Failed to delete habit');}
    setDeletingHabitId(null);
  }
  const habitsLoggedToday=habits.filter((h)=>h.logged_today).length;
  if(initialLoading)return(
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="h-8 w-48 rounded-xl animate-pulse" style={{background:'var(--ag-bg-surface)'}}/>
      <div className="grid grid-cols-3 gap-3">{[1,2,3].map((i)=><div key={i} className="h-20 rounded-2xl animate-pulse" style={{background:'var(--ag-bg-surface)'}}/>)}</div>
      <div className="h-64 rounded-2xl animate-pulse" style={{background:'var(--ag-bg-surface)'}}/>
    </div>
  );
  return(
    <DashboardPageWrapper><PageShell>
      <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-6">
        {showCelebration&&<CelebrationPulse/>}
        <BlurFade delay={0}>
          <PageHeader icon={Target} title="Focus & Habits" subtitle="Coached by Pulse"
            badge={<span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{background:'var(--ag-emerald)'}}/><span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{background:'var(--ag-emerald)'}}/></span>}
            actions={<motion.div whileTap={{scale:0.96}}><Button variant="ghost" size="sm" onClick={()=>void toggleFocusMode()} className="gap-1.5 text-xs min-h-[44px] px-3 rounded-xl transition-all focus-visible:outline-none" style={{background:settings?.focus_mode_active?'rgba(99,102,241,0.12)':'transparent',color:settings?.focus_mode_active?'var(--ag-indigo)':'var(--ag-text-secondary)',boxShadow:settings?.focus_mode_active?'0 0 0 1px rgba(99,102,241,0.22)':'none'}} aria-label={settings?.focus_mode_active?'Turn focus mode off':'Turn focus mode on'}>{settings?.focus_mode_active?<BellOff size={14}/>:<Bell size={14}/>}{settings?.focus_mode_active?'Focus ON':'Focus OFF'}</Button></motion.div>}
          />
        </BlurFade>
        <AnimatePresence>
          {deferredCount>0&&(<motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{type:'spring',duration:0.35,bounce:0}}>
            <GlassCard accent="indigo" className="px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="text-sm" style={{color:'var(--ag-text-primary)'}}><Bell size={14} className="inline mr-1.5" style={{color:'var(--ag-indigo)'}}/>{deferredCount} message{deferredCount>1?'s':''} held during focus</span><Button size="sm" variant="outline" className="text-xs min-h-[44px] rounded-lg flex-shrink-0" style={{borderColor:'var(--ag-border-default)',color:'var(--ag-indigo)'}} onClick={()=>void load()}>View now</Button></div></GlassCard>
          </motion.div>)}
        </AnimatePresence>
        <BlurFade delay={0.12}>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Focus streak" value={`${focusStreak}d`} icon={Flame} accent="violet"/>
            <StatCard label="Habits today" value={`${habitsLoggedToday}/${habits.length}`} icon={CheckCircle} accent="emerald"/>
            <StatCard label="This week" value={summary?formatDuration(summary.totalMinutesThisWeek):'0m'} icon={Clock} accent="indigo"/>
          </div>
        </BlurFade>
        <BlurFade delay={0.22}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full p-1 h-12 rounded-xl" style={{background:'var(--ag-bg-surface)',boxShadow:'0 0 0 1px rgba(139,92,246,0.08)'}}>
              <TabsTrigger value="focus" className="flex-1 rounded-lg h-10 text-sm font-medium transition-colors min-h-[44px]"><Timer size={15} className="mr-1.5"/>Focus Sessions</TabsTrigger>
              <TabsTrigger value="habits" className="flex-1 rounded-lg h-10 text-sm font-medium transition-colors min-h-[44px]"><Flame size={15} className="mr-1.5"/>Daily Habits</TabsTrigger>
            </TabsList>
            <TabsContent value="focus" className="mt-4 space-y-4">
              {session?(<FocusTimer session={session} progress={progress} remaining={remaining} remainStr={remainStr} elapsedStr={elapsedStr} isLoading={isLoading} onEnd={()=>end(true)}/>):showBreakSuggestion?(<BreakReminder onDismiss={()=>setShowBreakSuggestion(false)}/>):(<SessionStarter durInput={durInput} setDurInput={setDurInput} onOpenModal={()=>setShowStartModal(true)}/>)}
              <SessionHistory history={history} completedHistory={completedHistory}/>
              {completedHistory.length===0&&!session&&!showBreakSuggestion&&<EmptyFocus/>}
              {settings&&<BlockedDistractions blockedSites={(settings as typeof settings&{blocked_sites?:string}).blocked_sites}/>}
            </TabsContent>
            <TabsContent value="habits" className="mt-4">
              <HabitsTab habits={habits} habitsLoggedToday={habitsLoggedToday} deletingHabitId={deletingHabitId} onLogHabit={handleLogHabit} onDeleteHabit={handleDeleteHabit} onAddHabit={()=>setShowAddHabit(true)}/>
            </TabsContent>
          </Tabs>
        </BlurFade>
        <StartSessionModal open={showStartModal} onOpenChange={setShowStartModal} goalInput={goalInput} setGoalInput={setGoalInput} durInput={durInput} setDurInput={setDurInput} onStart={handleStartFocus} loading={isLoading}/>
        <AddHabitDialog open={showAddHabit} onOpenChange={setShowAddHabit} newHabitName={newHabitName} setNewHabitName={setNewHabitName} newHabitIcon={newHabitIcon} setNewHabitIcon={setNewHabitIcon} newHabitFreq={newHabitFreq} setNewHabitFreq={setNewHabitFreq} onAdd={handleAddHabit} loading={habitLoading}/>
      </div>
    </PageShell></DashboardPageWrapper>
  );
}
