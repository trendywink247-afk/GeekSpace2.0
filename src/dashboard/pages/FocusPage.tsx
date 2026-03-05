import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/services/api';
import { toast } from 'sonner';
import { Target, CheckCircle, Plus, Flame, Timer, Play, Bell, BellOff } from 'lucide-react';

interface FocusSession { id: number; started_at: number; ended_at: number | null; duration_min: number | null; goal: string | null; completed: number; }
interface Habit { id: number; name: string; icon: string; description: string | null; frequency: string; current_streak: number; longest_streak: number; logged_today: boolean; }
interface NotifSettings { focus_mode_active: number; dnd_start: string; dnd_end: string; urgent_bypass: number; batch_interval_min: number; }
const DURATIONS = [{label: "25 min (Pomodoro)", value: 25}, {label: "45 min", value: 45}, {label: "60 min", value: 60}, {label: "90 min", value: 90}];
const HABIT_ICONS = ["⭐","🏃","📚","💪","🧘","💧","🎯","✅","🔥","🎨"];
function pad(n: number) { return String(n).padStart(2, "0"); }
function useTimer(startMs: number | null, durationMin: number | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startMs) { setElapsed(0); return; }
    const id = setInterval(() => { setElapsed(Math.floor((Date.now() - startMs) / 1000)); }, 1000);
    return () => clearInterval(id);
  }, [startMs]);
  const total = durationMin ? durationMin * 60 : null;
  const remaining = total ? Math.max(0, total - elapsed) : null;
  return { elapsed, remaining, progress: total ? Math.min(100, (elapsed / total) * 100) : 0 };
}
function TimerRing({ progress, children }: { progress: number; children: React.ReactNode }) {
  const r = 70; const circ = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center w-48 h-48 mx-auto">
      <svg className="absolute inset-0" style={{ transform: "rotate(-90deg)" }} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#1a1a2e" strokeWidth="8" />
        <circle cx="80" cy="80" r={r} fill="none" stroke="#00F0FF" strokeWidth="8" strokeDasharray={circ} strokeDashoffset={circ * (1 - progress / 100)} style={{ transition: "stroke-dashoffset 1s linear" }} />
      </svg>
      <div className="relative z-10 text-center">{children}</div>
    </div>
  );
}
export function FocusPage() {
  const [session, setSession] = useState(null as FocusSession | null);
  const [habits, setHabits] = useState([] as Habit[]);
  const [settings, setSettings] = useState(null as NotifSettings | null);
  const [deferredCount, setDeferredCount] = useState(0);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [durInput, setDurInput] = useState(25);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitIcon, setNewHabitIcon] = useState("⭐");
  const [loading, setLoading] = useState(false);
  const { elapsed, remaining, progress } = useTimer(session?.started_at ?? null, session?.duration_min ?? null);
  const load = useCallback(async () => {
    try {
      const [s, h, ns, d] = await Promise.all([api.get("/focus/active"), api.get("/habits"), api.get("/focus/settings"), api.get("/focus/deferred")]);
      setSession((s.data as { session: FocusSession | null }).session);
      setHabits((h.data as { habits: Habit[] }).habits);
      setSettings((ns.data as { settings: NotifSettings }).settings);
      setDeferredCount((d.data as { count: number }).count);
    } catch { toast.error('Failed to load focus data'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function handleStartFocus() {
    setLoading(true);
    try {
      const res = await api.post("/focus/start", { goal: goalInput || null, durationMin: durInput });
      setSession((res.data as { session: FocusSession }).session);
      setShowStartModal(false); setGoalInput("");
    } catch { toast.error('Failed to start focus session'); }
    setLoading(false);
  }
  async function handleEndFocus() {
    setLoading(true);
    try { await api.post("/focus/end", { completed: true }); setSession(null); void load(); } catch { toast.error('Failed to end focus session'); }
    setLoading(false);
  }
  async function handleLogHabit(id: number) {
    try { await api.post("/habits/" + id + "/log", {}); void load(); } catch { toast.error('Failed to log habit'); }
  }
  async function handleAddHabit() {
    if (!newHabitName) return;
    try { await api.post("/habits", { name: newHabitName, icon: newHabitIcon }); setNewHabitName(""); setNewHabitIcon("⭐"); setShowAddHabit(false); void load(); } catch { toast.error('Failed to add habit'); }
  }
  async function handleDeleteHabit(id: number) {
    try { await api.delete("/habits/" + id); void load(); } catch { toast.error('Failed to delete habit'); }
  }
  async function toggleFocusMode() {
    const newVal = settings?.focus_mode_active ? 0 : 1;
    try { const res = await api.patch("/focus/settings", { focus_mode_active: newVal }); setSettings((res.data as { settings: NotifSettings }).settings); } catch { toast.error('Failed to update focus mode'); }
  }
  const elapsedStr = pad(Math.floor(elapsed / 60)) + ":" + pad(elapsed % 60);
  const remainStr = remaining !== null ? (pad(Math.floor(remaining / 60)) + ":" + pad(remaining % 60)) : "";
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#F4F6FF] flex items-center gap-2">
          <Target className="text-[#00F0FF]" size={24} /> Focus Mode
        </h1>
        <Button variant="ghost" size="sm" onClick={toggleFocusMode} className="gap-1 text-xs">
          {settings?.focus_mode_active ? <BellOff size={14} /> : <Bell size={14} />}
          {settings?.focus_mode_active ? "Focus ON" : "Focus OFF"}
        </Button>
      </div>
      {deferredCount > 0 && (
        <div className="bg-[#1a1a2e] border border-[#00F0FF]/30 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-[#E8E8F0]"><Bell size={14} className="inline mr-1 text-[#00F0FF]" />{deferredCount} messages held during focus</span>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDeferredCount(0); void load(); }}>View now</Button>
        </div>
      )}
      <Card className="bg-[#06060B] border-[#1a1a2e]">
        <CardHeader><CardTitle className="text-[#F4F6FF] flex items-center gap-2"><Timer size={18} className="text-[#00F0FF]" /> Pomodoro Timer</CardTitle></CardHeader>
        <CardContent>
          {session ? (
            <div className="space-y-4">
              <TimerRing progress={progress}>
                <div className="text-3xl font-mono font-bold text-[#00F0FF]">{remaining !== null ? remainStr : elapsedStr}</div>
                <div className="text-xs text-[#E8E8F0]/60">{remaining !== null ? "remaining" : "elapsed"}</div>
              </TimerRing>
              {session.goal && <p className="text-center text-sm text-[#E8E8F0]/80">Goal: {session.goal}</p>}
              <button onClick={handleEndFocus} disabled={loading} className="w-full py-2 px-4 rounded bg-red-600 hover:bg-red-700 text-white font-medium">End Session</button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-[#E8E8F0]/60 text-sm">Start a focus session to track your deep work.</p>
              <Button onClick={() => setShowStartModal(true)} className="bg-[#00F0FF] text-black hover:bg-[#00d4e0]"><Play size={16} className="mr-1" /> Start Focus</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="bg-[#06060B] border-[#1a1a2e]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#F4F6FF] flex items-center gap-2"><Flame size={18} className="text-orange-400" /> Daily Habits</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setShowAddHabit(true)} className="text-[#00F0FF] min-h-[36px]"><Plus size={16} /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {habits.length === 0 ? (
            <p className="text-[#E8E8F0]/60 text-sm text-center py-4">No habits yet. Add one to start building streaks!</p>
          ) : (
            <div className="space-y-2">
              {habits.map(h => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a2e]">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{h.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-[#F4F6FF]">{h.name}</p>
                      <p className="text-xs text-[#E8E8F0]/60"><Flame size={10} className="inline text-orange-400" /> {h.current_streak} day streak</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={"min-h-[44px] min-w-[44px] rounded flex items-center justify-center " + (h.logged_today ? "text-green-400" : "text-[#E8E8F0]/40 hover:text-green-300")} onClick={() => { if (!h.logged_today) void handleLogHabit(h.id); }} disabled={h.logged_today} aria-label={"Log " + h.name}><CheckCircle size={20} /></button>
                    <button className="min-h-[44px] min-w-[44px] rounded text-red-400/40 hover:text-red-400 text-sm flex items-center justify-center" onClick={() => void handleDeleteHabit(h.id)}>x</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={showStartModal} onOpenChange={setShowStartModal}>
        <DialogContent className="bg-[#06060B] border-[#1a1a2e] text-[#F4F6FF] max-w-[calc(100%-2rem)] sm:max-w-lg">
          <DialogHeader><DialogTitle>Start Focus Session</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="focus-goal" className="text-[#E8E8F0]">What are you working on?</Label>
              <Input id="focus-goal" value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="e.g. Write report, Fix bug..." className="mt-1 bg-[#1a1a2e] border-[#2a2a3e] text-[#F4F6FF]" />
            </div>
            <div>
              <Label className="text-[#E8E8F0]">Duration</Label>
              <Select value={String(durInput)} onValueChange={v => setDurInput(Number(v))}>
                <SelectTrigger className="mt-1 bg-[#1a1a2e] border-[#2a2a3e] text-[#F4F6FF]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#06060B] border-[#1a1a2e]">
                  {DURATIONS.map(d => <SelectItem key={d.value} value={String(d.value)} className="text-[#F4F6FF]">{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowStartModal(false)}>Cancel</Button>
            <Button onClick={handleStartFocus} disabled={loading} className="bg-[#00F0FF] text-black">Start</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showAddHabit} onOpenChange={setShowAddHabit}>
        <DialogContent className="bg-[#06060B] border-[#1a1a2e] text-[#F4F6FF] max-w-[calc(100%-2rem)] sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Habit</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[#E8E8F0]">Habit Name</Label>
              <Input value={newHabitName} onChange={e => setNewHabitName(e.target.value)} placeholder="e.g. Morning Workout, Reading..." className="mt-1 bg-[#1a1a2e] border-[#2a2a3e] text-[#F4F6FF]" />
            </div>
            <div>
              <Label className="text-[#E8E8F0]">Icon</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {HABIT_ICONS.map(ic => <button key={ic} onClick={() => setNewHabitIcon(ic)} className={"text-xl p-1 rounded " + (newHabitIcon === ic ? "bg-[#00F0FF]/20 ring-1 ring-[#00F0FF]" : "hover:bg-[#1a1a2e]")}>{ic}</button>)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddHabit(false)}>Cancel</Button>
            <Button onClick={handleAddHabit} className="bg-[#00F0FF] text-black" disabled={!newHabitName}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
