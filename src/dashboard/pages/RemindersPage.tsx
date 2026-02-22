// ============================================================
// Enhanced Reminders Page with Natural Language Input
// ============================================================

import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Plus,
  Calendar,
  Clock,
  Trash2,
  Check,
  Repeat,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  Mic,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardStore } from '@/stores/dashboardStore';
import { parseNaturalLanguageReminder } from '@/utils/reminderParser';
import type { ReminderChannel, ReminderCategory } from '@/types';

const categoryColors: Record<string, string> = {
  personal: '#00FFD4',
  work: '#00FF88',
  health: '#FF0080',
  other: '#FFB800',
};

const examples = [
  "Remind me tomorrow at 3pm to call mom",
  "Every Monday at 9am team standup",
  "In 2 hours take a break",
  "Daily at 8am drink water",
  "Next Tuesday submit report",
];

export function RemindersPage() {
  const { reminders, addReminder, toggleReminder, deleteReminder, loadDashboard } = useDashboardStore();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // Natural language input state
  const [naturalInput, setNaturalInput] = useState('');
  const [parsedReminder, setParsedReminder] = useState<ReturnType<typeof parseNaturalLanguageReminder> | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Legacy form state (for manual entry)
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

  // Parse natural language as user types
  useEffect(() => {
    if (naturalInput.trim()) {
      const parsed = parseNaturalLanguageReminder(naturalInput);
      setParsedReminder(parsed);
    } else {
      setParsedReminder(null);
    }
  }, [naturalInput]);

  const handleNaturalAdd = async () => {
    if (!parsedReminder) return;
    
    await addReminder({
      text: parsedReminder.text,
      datetime: parsedReminder.datetime.toISOString(),
      channel: 'telegram',
      recurring: parsedReminder.recurring,
      category: 'personal',
    });
    
    setNaturalInput('');
    setParsedReminder(null);
    setIsAddDialogOpen(false);
  };

  const handleExampleClick = (example: string) => {
    setNaturalInput(example);
    inputRef.current?.focus();
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser');
      return;
    }
    
    const SR = (window as unknown as { SpeechRecognition: new () => SpeechRecognition; webkitSpeechRecognition: new () => SpeechRecognition }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognition }).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setNaturalInput(transcript);
    };
    
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.start();
    setIsListening(true);
  };

  const handleLegacyAdd = async () => {
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

  const isOverdue = (datetime: string) => {
    return new Date(datetime) < new Date() && !reminders.find(r => r.datetime === datetime)?.completed;
  };

  return (
    <div className="space-y-6" data-testid="reminders-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Reminders
          </h1>
          <p className="text-[#6B7280]">
            {activeReminders.length} active, {completedReminders.length} completed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-[#00FFD4]/10 border border-[#00FFD4]/30">
            <span className="text-sm text-[#00FFD4]">{activeReminders.length} active</span>
          </div>
          <Button data-testid="create-reminder-button" onClick={() => setIsAddDialogOpen(true)} className="bg-[#00FFD4] hover:bg-[#00D4B0]">
            <Plus className="w-4 h-4 mr-2" />
            Add Reminder
          </Button>
        </div>
      </div>

      {/* Quick Add - Natural Language */}
      <Card className="bg-gradient-to-r from-[#00FFD4]/10 to-[#FF0080]/5 border-[#00FFD4]/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#00FFD4]" />
            <span className="text-sm font-medium text-[#E8E8F0]">Quick Add</span>
            <span className="text-xs text-[#6B7280]">Type naturally like "tomorrow at 3pm call mom"</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                ref={inputRef}
                placeholder="Remind me..."
                value={naturalInput}
                onChange={(e) => setNaturalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parsedReminder) {
                    handleNaturalAdd();
                  }
                }}
                className="w-full px-4 py-3 bg-[#030304] border border-[#00FFD4]/20 rounded-xl text-[#E8E8F0] placeholder-[#6B7280] focus:outline-none focus:border-[#00FFD4]/40"
              />
              {parsedReminder && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="text-xs text-[#00FF88]">✓ Parsed</span>
                </div>
              )}
            </div>
            <button
              onClick={handleVoiceInput}
              className={`p-3 rounded-xl transition-colors ${
                isListening 
                  ? 'bg-[#FF6161]/20 text-[#FF6161]' 
                  : 'bg-[#030304] border border-[#00FFD4]/20 text-[#6B7280] hover:text-white'
              }`}
            >
              <Mic className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
            </button>
            <Button
              onClick={handleNaturalAdd}
              disabled={!parsedReminder}
              className="bg-[#00FFD4] hover:bg-[#00D4B0] disabled:opacity-50"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
          
          {/* Parsed preview */}
          {parsedReminder && (
            <div className="mt-3 p-3 rounded-lg bg-[#030304] border border-[#00FF88]/20">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#00FF88]">✓</span>
                <span className="text-[#E8E8F0]">{parsedReminder.text}</span>
                <span className="text-[#6B7280]">at</span>
                <span className="text-[#FFB800]">
                  {parsedReminder.datetime.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {parsedReminder.recurring && (
                  <Badge className="bg-[#00FFD4]/20 text-[#00FFD4]">
                    <Repeat className="w-3 h-3 mr-1" />
                    {parsedReminder.recurring}
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {/* Examples */}
          <div className="mt-3">
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="text-xs text-[#6B7280] hover:text-[#00FFD4] transition-colors"
            >
              {showExamples ? 'Hide' : 'Show'} examples
            </button>
            {showExamples && (
              <div className="mt-2 flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    onClick={() => handleExampleClick(example)}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#030304] border border-[#00FFD4]/20 text-[#6B7280] hover:text-[#E8E8F0] hover:border-[#00FFD4]/40 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder="Search reminders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0A0A0F] border-[#00FFD4]/20"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="bg-[#0A0A0F] border border-[#00FFD4]/20">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center bg-[#0A0A0F] border border-[#00FFD4]/20 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-[#00FFD4]/20 text-[#00FFD4]' : 'text-[#6B7280]'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`p-2 rounded transition-colors ${viewMode === 'calendar' ? 'bg-[#00FFD4]/20 text-[#00FFD4]' : 'text-[#6B7280]'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reminders List */}
      {viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredReminders.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-[#00FFD4]/30 mx-auto mb-4" />
              <p className="text-[#6B7280]">No reminders yet</p>
              <p className="text-sm text-[#6B7280]/70 mt-1">Use the quick add above to create your first reminder</p>
            </div>
          ) : (
            filteredReminders.map((reminder) => {
              const formatted = formatDateTime(reminder.datetime);
              const overdue = isOverdue(reminder.datetime);
              
              return (
                <Card
                  key={reminder.id}
                  className={`bg-[#0A0A0F] border transition-all ${
                    reminder.completed
                      ? 'border-[#00FFD4]/10 opacity-60'
                      : overdue
                      ? 'border-[#FF6161]/30'
                      : 'border-[#00FFD4]/20'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Date badge */}
                      <div className={`flex-shrink-0 w-14 text-center p-2 rounded-xl ${
                        reminder.completed
                          ? 'bg-[#00FFD4]/10'
                          : overdue
                          ? 'bg-[#FF6161]/10'
                          : 'bg-[#00FFD4]/10'
                      }`}>
                        <div className={`text-xs ${overdue ? 'text-[#FF6161]' : 'text-[#00FFD4]'}`}>
                          {formatted.month}
                        </div>
                        <div className={`text-xl font-bold ${overdue ? 'text-[#FF6161]' : 'text-[#E8E8F0]'}`}>
                          {formatted.day}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`font-medium ${reminder.completed ? 'line-through text-[#6B7280]' : 'text-[#E8E8F0]'}`}>
                              {reminder.text}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-[#FF6161]' : 'text-[#6B7280]'}`}>
                                <Clock className="w-3 h-3" />
                                {formatted.time}
                                {overdue && ' (overdue)'}
                              </span>
                              <Badge
                                style={{ backgroundColor: `${categoryColors[reminder.category]}20`, color: categoryColors[reminder.category], borderColor: `${categoryColors[reminder.category]}40` }}
                                className="text-xs"
                              >
                                {reminder.category}
                              </Badge>
                              {reminder.recurring && (
                                <Badge className="bg-[#00FFD4]/20 text-[#00FFD4] text-xs">
                                  <Repeat className="w-3 h-3 mr-1" />
                                  {reminder.recurring}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleComplete(reminder.id)}
                              className={`p-2 rounded-lg transition-colors ${
                                reminder.completed
                                  ? 'bg-[#00FF88]/20 text-[#00FF88]'
                                  : 'bg-[#030304] text-[#6B7280] hover:text-[#00FF88]'
                              }`}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(reminder.id)}
                              className="p-2 rounded-lg bg-[#030304] text-[#6B7280] hover:text-[#FF6161] transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        // Calendar view
        <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#00FFD4]" />
              Calendar View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-xs text-[#6B7280] py-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-[#030304] border border-[#00FFD4]/10 p-1 text-xs text-[#6B7280]"
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Reminder Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-[#0A0A0F] border-[#00FFD4]/20 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Add Reminder</DialogTitle>
          </DialogHeader>
          
          {/* Natural Language Input */}
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[#6B7280] mb-2 block">
                Type naturally (e.g., "tomorrow at 3pm call mom")
              </label>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  data-testid="reminder-text"
                  placeholder="Remind me..."
                  value={naturalInput}
                  onChange={(e) => setNaturalInput(e.target.value)}
                  className="flex-1 bg-[#030304] border-[#00FFD4]/20"
                />
                <Button
                  onClick={handleNaturalAdd}
                  disabled={!parsedReminder}
                  className="bg-[#00FFD4] hover:bg-[#00D4B0]"
                >
                  <Wand2 className="w-4 h-4" />
                </Button>
              </div>
              
              {parsedReminder && (
                <div className="mt-2 p-3 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/20">
                  <p className="text-sm text-[#E8E8F0]">{parsedReminder.text}</p>
                  <p className="text-xs text-[#00FF88] mt-1">
                    {parsedReminder.datetime.toLocaleString()}
                    {parsedReminder.recurring && ` • ${parsedReminder.recurring}`}
                  </p>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#00FFD4]/20" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-2 bg-[#0A0A0F] text-xs text-[#6B7280]">Or manually</span>
              </div>
            </div>

            {/* Manual Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#6B7280] mb-1 block">What to remind?</label>
                <Input
                  placeholder="Enter reminder text..."
                  value={newReminder.text}
                  onChange={(e) => setNewReminder({ ...newReminder, text: e.target.value })}
                  className="bg-[#030304] border-[#00FFD4]/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block">When?</label>
                  <Input
                    type="datetime-local"
                    value={newReminder.datetime}
                    onChange={(e) => setNewReminder({ ...newReminder, datetime: e.target.value })}
                    className="bg-[#030304] border-[#00FFD4]/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block">Category</label>
                  <select
                    value={newReminder.category}
                    onChange={(e) => setNewReminder({ ...newReminder, category: e.target.value as ReminderCategory })}
                    className="w-full px-3 py-2 rounded-md bg-[#030304] border border-[#00FFD4]/20 text-[#E8E8F0] text-sm"
                  >
                    <option value="personal">Personal</option>
                    <option value="work">Work</option>
                    <option value="health">Health</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#6B7280] mb-1 block">Recurring?</label>
                <div className="flex gap-2">
                  {['', 'daily', 'weekly', 'monthly'].map((rec) => (
                    <button
                      key={rec || 'once'}
                      onClick={() => setNewReminder({ ...newReminder, recurring: rec })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        newReminder.recurring === rec
                          ? 'bg-[#00FFD4] text-white'
                          : 'bg-[#030304] text-[#6B7280] hover:text-white'
                      }`}
                    >
                      {rec || 'Once'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLegacyAdd} disabled={!newReminder.text || !newReminder.datetime}>
              Add Reminder
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
