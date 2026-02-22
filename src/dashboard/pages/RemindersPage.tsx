import { useState, useEffect } from 'react';
import {
  Bell,
  Plus,
  Calendar,
  Clock,
  MessageSquare,
  Trash2,
  Check,
  Repeat,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { ReminderChannel, ReminderCategory } from '@/types';

const categoryColors: Record<string, string> = {
  personal: '#7B61FF',
  work: '#61FF7B',
  health: '#FF61DC',
  other: '#FFD761',
};

export function RemindersPage() {
  const { reminders, addReminder, toggleReminder, deleteReminder, loadDashboard } = useDashboardStore();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newReminder, setNewReminder] = useState<{
    text: string;
    datetime: string;
    channel: ReminderChannel;
    recurring: string;
    category: ReminderCategory;
  }>({
    text: '',
    datetime: '',
    channel: 'telegram',
    recurring: '',
    category: 'personal',
  });

  // Poll for reminders every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboard();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const handleAdd = async () => {
    if (!newReminder.text || !newReminder.datetime) return;
    await addReminder({
      text: newReminder.text,
      datetime: newReminder.datetime,
      channel: newReminder.channel,
      recurring: newReminder.recurring || undefined,
      category: newReminder.category,
    });
    setNewReminder({ text: '', datetime: '', channel: 'telegram', recurring: '', category: 'personal' });
    setIsAddDialogOpen(false);
  };

  const handleComplete = async (id: string) => {
    await toggleReminder(id);
  };

  const handleDelete = async (id: string) => {
    await deleteReminder(id);
  };

  const filteredReminders = reminders.filter(r => {
    if (filter === 'active') return !r.completed;
    if (filter === 'completed') return r.completed;
    return true;
  }).filter(r => r.text.toLowerCase().includes(searchQuery.toLowerCase()));

  const activeReminders = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r => r.completed);

  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    };
  };

  // Calendar generation
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today);
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getRemindersForDay = (day: number) => {
    return reminders.filter(r => {
      const date = new Date(r.datetime);
      return date.getDate() === day &&
             date.getMonth() === currentMonth.getMonth() &&
             date.getFullYear() === currentMonth.getFullYear();
    });
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 px-1 md:px-0" data-testid="reminders-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Reminders
          </h1>
          <p className="text-sm md:text-base text-[#A7ACB8]">
            <span className="text-[#7B61FF] font-medium">{activeReminders.length}</span> active,{' '}
            <span className="text-[#61FF7B]">{completedReminders.length}</span> completed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'calendar')}>
            <TabsList className="bg-[#0B0B10] border border-[#7B61FF]/20">
              <TabsTrigger value="list" className="data-[state=active]:bg-[#7B61FF] min-h-[44px] min-w-[44px]">
                <List className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="calendar" className="data-[state=active]:bg-[#7B61FF] min-h-[44px] min-w-[44px]">
                <LayoutGrid className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-[#7B61FF] hover:bg-[#6B51EF] press-scale min-h-[44px]" data-testid="create-reminder-button">
            <Plus className="w-4 h-4 mr-2" />New
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7ACB8]" />
          <Input
            placeholder="Search reminders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0B0B10] border-[#7B61FF]/30 text-[#F4F6FF] min-h-[44px]"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="bg-[#0B0B10] border border-[#7B61FF]/20 overflow-x-auto flex-nowrap w-full sm:w-auto">
            <TabsTrigger value="all" className="data-[state=active]:bg-[#7B61FF] min-h-[40px]">All</TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-[#7B61FF] min-h-[40px]">Active</TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-[#7B61FF] min-h-[40px]">Done</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <div className="space-y-4">
          {filteredReminders.length > 0 ? (
            filteredReminders.map((reminder) => {
              const { date, time } = formatDateTime(reminder.datetime);
              return (
                <Card
                  key={reminder.id}
                  className={`bg-[#0B0B10] border-[#7B61FF]/20 transition-all duration-300 hover:border-[#7B61FF]/40 press-scale ${reminder.completed ? 'opacity-60' : ''}`}
                >
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-start gap-3 md:gap-4">
                      <button
                        onClick={() => handleComplete(reminder.id)}
                        className={`w-7 h-7 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors press-scale ${
                          reminder.completed ? 'bg-[#61FF7B] border-[#61FF7B]' : 'border-[#7B61FF]/40 hover:border-[#7B61FF]'
                        }`}
                      >
                        {reminder.completed && <Check className="w-4 h-4 text-[#05050A]" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium flex items-center gap-1 flex-wrap ${reminder.completed ? 'line-through text-[#A7ACB8]' : 'text-[#F4F6FF]'}`}>
                          {reminder.text}
                          {reminder.createdBy === 'pico-fleet' && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[#7B61FF]/10 text-[#7B61FF] border border-[#7B61FF]/20 ml-1 no-underline" style={{ textDecoration: 'none' }}>
                              Weebo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <Badge variant="outline" className="border-[#7B61FF]/30 text-[#A7ACB8]">
                            <Calendar className="w-3 h-3 mr-1" />{date}
                          </Badge>
                          <Badge variant="outline" className="border-[#7B61FF]/30 text-[#A7ACB8]">
                            <Clock className="w-3 h-3 mr-1" />{time}
                          </Badge>
                          {reminder.recurring && (
                            <Badge variant="outline" className="border-[#FFD761]/30 text-[#FFD761]">
                              <Repeat className="w-3 h-3 mr-1" />{reminder.recurring}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            style={{ borderColor: `${categoryColors[reminder.category]}40`, color: categoryColors[reminder.category] }}
                          >
                            {reminder.category}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{
                            backgroundColor: reminder.channel === 'telegram' ? '#0088cc15' :
                                           reminder.channel === 'email' ? '#4285f415' : '#7B61FF15'
                          }}
                        >
                          <MessageSquare className="w-4 h-4" style={{
                            color: reminder.channel === 'telegram' ? '#0088cc' :
                                   reminder.channel === 'email' ? '#4285f4' : '#7B61FF'
                          }} />
                        </div>
                        <button
                          onClick={() => handleDelete(reminder.id)}
                          className="p-2 rounded-lg hover:bg-[#FF6161]/10 text-[#A7ACB8] hover:text-[#FF6161] transition-colors press-scale min-h-[44px] min-w-[44px] flex items-center justify-center"
                          data-testid="delete-reminder-button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-[#7B61FF]/30 mx-auto mb-4" />
              <p className="text-[#A7ACB8]">No reminders found</p>
            </div>
          )}
        </div>
      ) : (
        /* Calendar View */
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#7B61FF]" />
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="border-[#7B61FF]/30 min-h-[44px] min-w-[44px]">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="border-[#7B61FF]/30 min-h-[44px]">
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="border-[#7B61FF]/30 min-h-[44px] min-w-[44px]">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-1 min-w-[320px]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                <div key={day} className="text-center text-sm text-[#A7ACB8] py-2">
                  <span className="hidden md:inline">{day}</span>
                  <span className="md:hidden">{'SMTWTFS'[idx]}</span>
                </div>
              ))}
              {emptyDays.map(i => <div key={`empty-${i}`} className="aspect-square" />)}
              {calendarDays.map(day => {
                const dayReminders = getRemindersForDay(day);
                const isToday = day === today.getDate() &&
                               currentMonth.getMonth() === today.getMonth() &&
                               currentMonth.getFullYear() === today.getFullYear();
                return (
                  <div
                    key={day}
                    className={`aspect-square p-1 md:p-2 rounded-lg border transition-all cursor-pointer hover:border-[#7B61FF]/50 ${
                      isToday ? 'bg-[#7B61FF]/20 border-[#7B61FF]/50' : 'border-[#7B61FF]/10 bg-[#05050A]'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${isToday ? 'text-[#7B61FF]' : 'text-[#F4F6FF]'}`}>{day}</div>
                    <div className="space-y-1">
                      {dayReminders.slice(0, 3).map((r, i) => (
                        <div
                          key={i}
                          className="text-xs truncate px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: `${categoryColors[r.category]}20`,
                            color: categoryColors[r.category],
                            textDecoration: r.completed ? 'line-through' : 'none'
                          }}
                        >
                          <span className="hidden md:inline">{r.text}</span>
                          <span className="md:hidden w-2 h-2 rounded-full inline-block" style={{ backgroundColor: categoryColors[r.category] }}>&bull;</span>
                        </div>
                      ))}
                      {dayReminders.length > 3 && (
                        <div className="text-xs text-[#A7ACB8]">+{dayReminders.length - 3}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-[#0B0B10] border border-[#7B61FF]/30 text-[#F4F6FF] max-w-md mx-2 md:mx-auto p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#7B61FF]" />New Reminder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3 md:pt-4">
            <div>
              <label className="text-sm text-[#A7ACB8] mb-2 block">What to remind?</label>
              <Input
                value={newReminder.text}
                onChange={(e) => setNewReminder({ ...newReminder, text: e.target.value })}
                placeholder="e.g., Call mom, Submit report..."
                className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
                data-testid="reminder-text"
              />
            </div>
            <div>
              <label className="text-sm text-[#A7ACB8] mb-2 block">When?</label>
              <Input
                type="datetime-local"
                value={newReminder.datetime}
                onChange={(e) => setNewReminder({ ...newReminder, datetime: e.target.value })}
                className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
                data-testid="reminder-datetime"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">Category</label>
                <select
                  value={newReminder.category}
                  onChange={(e) => setNewReminder({ ...newReminder, category: e.target.value as ReminderCategory })}
                  className="w-full p-2 rounded-lg bg-[#05050A] border border-[#7B61FF]/30 text-[#F4F6FF]"
                >
                  <option value="personal">Personal</option>
                  <option value="work">Work</option>
                  <option value="health">Health</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">Repeat</label>
                <select
                  value={newReminder.recurring}
                  onChange={(e) => setNewReminder({ ...newReminder, recurring: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[#05050A] border border-[#7B61FF]/30 text-[#F4F6FF]"
                >
                  <option value="">Don't repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-[#A7ACB8] mb-2 block">Channel</label>
              <div className="flex gap-2">
                {(['telegram', 'email', 'push', 'whatsapp'] as ReminderChannel[]).map((channel) => (
                  <button
                    key={channel}
                    onClick={() => setNewReminder({ ...newReminder, channel })}
                    className={`flex-1 p-2 rounded-lg border capitalize text-sm transition-all press-scale min-h-[44px] ${
                      newReminder.channel === channel
                        ? 'border-[#7B61FF] bg-[#7B61FF]/20 text-[#7B61FF]'
                        : 'border-[#7B61FF]/20 bg-[#05050A] text-[#A7ACB8]'
                    }`}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 border-[#7B61FF]/30 min-h-[44px] press-scale">
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!newReminder.text || !newReminder.datetime}
                className="flex-1 bg-[#7B61FF] hover:bg-[#6B51EF] min-h-[44px] press-scale"
                data-testid="save-reminder-button"
              >
                Add Reminder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
