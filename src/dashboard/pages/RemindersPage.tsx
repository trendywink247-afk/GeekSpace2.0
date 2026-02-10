import { useState } from 'react';
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

interface Reminder {
  id: string;
  text: string;
  datetime: string;
  channel: 'telegram' | 'email' | 'push';
  recurring?: string;
  completed: boolean;
  category: 'personal' | 'work' | 'health' | 'other';
}

const initialReminders: Reminder[] = [
  { id: '1', text: 'Call mom', datetime: '2026-02-12T09:00', channel: 'telegram', category: 'personal', completed: false },
  { id: '2', text: 'Submit project report', datetime: '2026-02-12T17:00', channel: 'email', recurring: 'weekly', category: 'work', completed: false },
  { id: '3', text: 'Team standup', datetime: '2026-02-12T10:00', channel: 'push', recurring: 'daily', category: 'work', completed: true },
  { id: '4', text: 'Pay rent', datetime: '2026-02-15T09:00', channel: 'telegram', recurring: 'monthly', category: 'personal', completed: false },
  { id: '5', text: 'Gym workout', datetime: '2026-02-12T07:00', channel: 'push', category: 'health', completed: false },
  { id: '6', text: 'Review pull requests', datetime: '2026-02-12T14:00', channel: 'email', category: 'work', completed: false },
];

const categoryColors: Record<string, string> = {
  personal: '#7B61FF',
  work: '#61FF7B',
  health: '#FF61DC',
  other: '#FFD761',
};

export function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newReminder, setNewReminder] = useState<{
    text: string;
    datetime: string;
    channel: 'telegram' | 'email' | 'push';
    recurring: string;
    category: 'personal' | 'work' | 'health' | 'other';
  }>({
    text: '',
    datetime: '',
    channel: 'telegram',
    recurring: '',
    category: 'personal',
  });

  const handleAdd = () => {
    if (!newReminder.text || !newReminder.datetime) return;
    const reminder: Reminder = {
      id: Date.now().toString(),
      text: newReminder.text,
      datetime: newReminder.datetime,
      channel: newReminder.channel,
      recurring: newReminder.recurring || undefined,
      completed: false,
      category: newReminder.category,
    };
    setReminders([...reminders, reminder]);
    setNewReminder({ text: '', datetime: '', channel: 'telegram', recurring: '', category: 'personal' });
    setIsAddDialogOpen(false);
  };

  const handleComplete = (id: string) => {
    setReminders(reminders.map(r => r.id === id ? { ...r, completed: !r.completed } : r));
  };

  const handleDelete = (id: string) => {
    setReminders(reminders.filter(r => r.id !== id));
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Reminders
          </h1>
          <p className="text-[#A7ACB8]">
            <span className="text-[#7B61FF] font-medium">{activeReminders.length}</span> active,{' '}
            <span className="text-[#61FF7B]">{completedReminders.length}</span> completed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'calendar')}>
            <TabsList className="bg-[#0B0B10] border border-[#7B61FF]/20">
              <TabsTrigger value="list" className="data-[state=active]:bg-[#7B61FF]">
                <List className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="calendar" className="data-[state=active]:bg-[#7B61FF]">
                <LayoutGrid className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
            <Plus className="w-4 h-4 mr-2" />New
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7ACB8]" />
          <Input
            placeholder="Search reminders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0B0B10] border-[#7B61FF]/30 text-[#F4F6FF]"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="bg-[#0B0B10] border border-[#7B61FF]/20">
            <TabsTrigger value="all" className="data-[state=active]:bg-[#7B61FF]">All</TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-[#7B61FF]">Active</TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-[#7B61FF]">Done</TabsTrigger>
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
                  className={`bg-[#0B0B10] border-[#7B61FF]/20 transition-all duration-300 hover:border-[#7B61FF]/40 ${reminder.completed ? 'opacity-60' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => handleComplete(reminder.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors ${
                          reminder.completed ? 'bg-[#61FF7B] border-[#61FF7B]' : 'border-[#7B61FF]/40 hover:border-[#7B61FF]'
                        }`}
                      >
                        {reminder.completed && <Check className="w-4 h-4 text-[#05050A]" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${reminder.completed ? 'line-through text-[#A7ACB8]' : 'text-[#F4F6FF]'}`}>
                          {reminder.text}
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
                          className="p-2 rounded-lg hover:bg-[#FF6161]/10 text-[#A7ACB8] hover:text-[#FF6161] transition-colors"
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
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="border-[#7B61FF]/30">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="border-[#7B61FF]/30">
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="border-[#7B61FF]/30">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm text-[#A7ACB8] py-2">{day}</div>
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
                    className={`aspect-square p-2 rounded-lg border transition-all cursor-pointer hover:border-[#7B61FF]/50 ${
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
                          {r.text}
                        </div>
                      ))}
                      {dayReminders.length > 3 && (
                        <div className="text-xs text-[#A7ACB8]">+{dayReminders.length - 3} more</div>
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
        <DialogContent className="bg-[#0B0B10] border border-[#7B61FF]/30 text-[#F4F6FF] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#7B61FF]" />New Reminder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-[#A7ACB8] mb-2 block">What to remind?</label>
              <Input
                value={newReminder.text}
                onChange={(e) => setNewReminder({ ...newReminder, text: e.target.value })}
                placeholder="e.g., Call mom, Submit report..."
                className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
              />
            </div>
            <div>
              <label className="text-sm text-[#A7ACB8] mb-2 block">When?</label>
              <Input
                type="datetime-local"
                value={newReminder.datetime}
                onChange={(e) => setNewReminder({ ...newReminder, datetime: e.target.value })}
                className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">Category</label>
                <select
                  value={newReminder.category}
                  onChange={(e) => setNewReminder({ ...newReminder, category: e.target.value as any })}
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
                {(['telegram', 'email', 'push'] as const).map((channel) => (
                  <button
                    key={channel}
                    onClick={() => setNewReminder({ ...newReminder, channel })}
                    className={`flex-1 p-2 rounded-lg border capitalize text-sm transition-all ${
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
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 border-[#7B61FF]/30">
                Cancel
              </Button>
              <Button 
                onClick={handleAdd} 
                disabled={!newReminder.text || !newReminder.datetime}
                className="flex-1 bg-[#7B61FF] hover:bg-[#6B51EF]"
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