import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageShell } from '@/components/agentin/PageShell';
import {
  Share2, Plus, Trash2, CheckCircle, XCircle, Clock, Loader2,
  Instagram, Facebook, Webhook, Key, Send, Calendar,
  ToggleLeft, ToggleRight, Edit3, Eye, AlertCircle, Image, Film,
  Sparkles, Hash, Twitter, Linkedin, TrendingUp, Users,
  Heart, MessageCircle, ChevronLeft, ChevronRight, CalendarDays,
  Target, Wand2, Globe, Copy, Megaphone, Scissors, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { socialMediaService, agentService } from '@/services/api';
import type { SocialAccount, ContentPlan, ContentPlanItem } from '@/services/api';

// ---- Status helpers ----

const statusColors: Record<string, string> = {
  active: '#00FF88',
  paused: '#FFB800',
  draft: '#6B7280',
  scheduled: '#00F0FF',
  posting: '#FFB800',
  posted: '#00FF88',
  failed: '#FF6161',
  completed: '#00FF88',
  cancelled: '#6B7280',
};

function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] || '#6B7280';
  return (
    <Badge variant="outline" className="text-xs border-current" style={{ color }}>
      {status}
    </Badge>
  );
}

function StatusIcon({ status }: { status: string }) {
  const color = statusColors[status] || '#6B7280';
  switch (status) {
    case 'posted':
    case 'completed':
    case 'active':
      return <CheckCircle className="w-4 h-4" style={{ color }} />;
    case 'failed':
      return <XCircle className="w-4 h-4" style={{ color }} />;
    case 'posting':
      return <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />;
    case 'scheduled':
      return <Clock className="w-4 h-4" style={{ color }} />;
    default:
      return <AlertCircle className="w-4 h-4" style={{ color }} />;
  }
}

// ---- Tone & Platform types ----

type Tone = 'informative' | 'inspirational' | 'behind-the-scenes' | 'educational' | 'promotional' | 'casual';
type Platform = 'twitter' | 'linkedin' | 'instagram';

const TONES: { value: Tone; label: string }[] = [
  { value: 'informative', label: 'Informative' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'behind-the-scenes', label: 'Behind-the-scenes' },
  { value: 'educational', label: 'Educational' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'casual', label: 'Casual' },
];

const PLATFORMS: { value: Platform; label: string; limit: number; color: string }[] = [
  { value: 'twitter', label: 'Twitter / X', limit: 280, color: '#1DA1F2' },
  { value: 'linkedin', label: 'LinkedIn', limit: 3000, color: '#0A66C2' },
  { value: 'instagram', label: 'Instagram', limit: 2200, color: '#E1306C' },
];

function PlatformIcon({ platform, className, style }: { platform: Platform; className?: string; style?: React.CSSProperties }) {
  switch (platform) {
    case 'twitter': return <Twitter className={className} style={style} />;
    case 'linkedin': return <Linkedin className={className} style={style} />;
    case 'instagram': return <Instagram className={className} style={style} />;
  }
}

// ---- Tone Selector Pills ----

function TonePills({ selected, onChange }: { selected: Tone; onChange: (t: Tone) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TONES.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-3 py-1.5 min-h-[44px] rounded-full text-xs font-medium transition-all ${
            selected === t.value
              ? 'bg-[#00F0FF]/20 text-[var(--ag-cyan)] border border-[#00F0FF]/40 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
              : 'bg-[#06060B] text-[var(--ag-text-muted)] border border-[var(--ag-border-subtle)] hover:border-[#00F0FF]/20 hover:text-[var(--ag-text-primary)]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---- Platform Badge Selector ----

function PlatformBadges({ selected, onChange }: { selected: Platform; onChange: (p: Platform) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full text-xs font-medium transition-all ${
            selected === p.value
              ? 'border shadow-[0_0_8px_rgba(0,0,0,0.2)]'
              : 'bg-[#06060B] text-[var(--ag-text-muted)] border border-[var(--ag-border-subtle)] hover:border-[#00F0FF]/20 hover:text-[var(--ag-text-primary)]'
          }`}
          style={selected === p.value ? { background: `${p.color}20`, color: p.color, borderColor: `${p.color}60` } : undefined}
        >
          <PlatformIcon platform={p.value} className="w-3.5 h-3.5" />
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ---- Character Counter ----

function CharacterCounter({ count, platform }: { count: number; platform: Platform }) {
  const info = PLATFORMS.find((p) => p.value === platform)!;
  const pct = Math.min((count / info.limit) * 100, 100);
  const isOver = count > info.limit;
  const barColor = isOver ? '#FF6161' : pct > 90 ? '#FFB800' : '#00F0FF';

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 rounded-full bg-[#1a1a2e] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums" style={{ color: barColor }}>
        {count}/{info.limit}
      </span>
    </div>
  );
}

// ---- Hashtag Suggestions ----

function HashtagSuggestions({ text }: { text: string }) {
  const hashtags = useMemo(() => {
    if (!text || text.length < 10) return [];
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const unique = [...new Set(words)].slice(0, 8);
    return unique.map((w) => `#${w.replace(/[^a-z0-9]/g, '')}`).filter((h) => h.length > 2);
  }, [text]);

  if (hashtags.length === 0) return null;

  return (
    <div className="mt-3 p-3 rounded-lg bg-[#06060B] border border-[var(--ag-border-subtle)]">
      <div className="flex items-center gap-1.5 mb-2">
        <Hash className="w-3.5 h-3.5 text-[var(--ag-cyan)]" />
        <span className="text-xs font-medium text-[var(--ag-text-muted)]">Suggested Hashtags</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hashtags.map((tag) => (
          <span key={tag} className="px-2 py-0.5 rounded-full bg-[#00F0FF]/10 text-[var(--ag-cyan)] text-xs">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Post Preview Card ----

function PostPreviewCard({ text, platform }: { text: string; platform: Platform }) {
  if (!text) return null;

  const info = PLATFORMS.find((p) => p.value === platform)!;
  const truncated = text.length > info.limit ? text.slice(0, info.limit) + '...' : text;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Eye className="w-3.5 h-3.5 text-[var(--ag-text-muted)]" />
        <span className="text-xs font-medium text-[var(--ag-text-muted)]">Preview on {info.label}</span>
      </div>
      <div
        className="rounded-xl border p-4 space-y-2"
        style={{ borderColor: `${info.color}30`, background: '#08080F' }}
      >
        {/* Mock platform header */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: `${info.color}20` }}
          >
            <PlatformIcon platform={platform} className="w-4 h-4" style={{ color: info.color } as React.CSSProperties} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--ag-text-primary)]">Your Brand</span>
            <span className="text-[10px] text-[var(--ag-text-muted)] block">
              {platform === 'twitter' ? '@yourbrand' : platform === 'linkedin' ? 'Your Brand Inc.' : '@yourbrand'}
            </span>
          </div>
        </div>
        {/* Body text */}
        <p className="text-sm text-[var(--ag-text-primary)] whitespace-pre-wrap leading-relaxed">{truncated}</p>
        {/* Mock engagement bar */}
        <div className="flex items-center gap-4 pt-2 border-t border-[var(--ag-border-subtle)]">
          <span className="flex items-center gap-1 text-[10px] text-[var(--ag-text-muted)]">
            <Heart className="w-3 h-3" /> 0
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--ag-text-muted)]">
            <MessageCircle className="w-3 h-3" /> 0
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--ag-text-muted)]">
            <Share2 className="w-3 h-3" /> 0
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- Thread Composer (Twitter) ----

function splitIntoThread(text: string): string[] {
  if (text.length <= 280) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const tweets: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    // Reserve space for "N/ " prefix (up to "99/ " = 4 chars)
    const maxLen = 280 - 4;
    if ((current + ' ' + trimmed).trim().length <= maxLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) tweets.push(current);
      // If a single sentence exceeds maxLen, hard-split on word boundary
      if (trimmed.length > maxLen) {
        const words = trimmed.split(/\s+/);
        let chunk = '';
        for (const word of words) {
          if ((chunk + ' ' + word).trim().length <= maxLen) {
            chunk = (chunk + ' ' + word).trim();
          } else {
            if (chunk) tweets.push(chunk);
            chunk = word;
          }
        }
        if (chunk) current = chunk;
      } else {
        current = trimmed;
      }
    }
  }
  if (current) tweets.push(current);

  return tweets;
}

function ThreadComposer({ text, onCopy }: { text: string; onCopy: (content: string) => void }) {
  const tweets = useMemo(() => splitIntoThread(text), [text]);

  if (tweets.length <= 1) return null;

  const numbered = tweets.map((t, i) => `${i + 1}/ ${t}`);
  const fullThread = numbered.join('\n\n');

  return (
    <div className="mt-3 p-3 rounded-lg bg-[#06060B] border border-[var(--ag-border-subtle)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Scissors className="w-3.5 h-3.5 text-[var(--ag-cyan)]" />
          <span className="text-xs font-medium text-[var(--ag-text-muted)]">Thread Preview ({tweets.length} tweets)</span>
        </div>
        <CopyButton
          text={fullThread}
          label="Copy Thread"
          onCopy={onCopy}
        />
      </div>
      <div className="space-y-2">
        {numbered.map((tweet, i) => {
          const bodyLen = tweets[i].length + `${i + 1}/ `.length;
          const isOver = bodyLen > 280;
          return (
            <div
              key={i}
              className="p-2.5 rounded-lg border text-sm text-[var(--ag-text-primary)] whitespace-pre-wrap"
              style={{
                borderColor: isOver ? '#FF616140' : '#1a1a2e',
                background: isOver ? '#FF616108' : '#0C0C18',
              }}
            >
              {tweet}
              <div className="flex justify-end mt-1">
                <span
                  className="text-[10px] font-mono tabular-nums"
                  style={{ color: isOver ? '#FF6161' : bodyLen > 250 ? '#FFB800' : '#9CA3AF' }}
                >
                  {bodyLen}/280
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Copy Button with visual feedback ----

function CopyButton({
  text,
  label = 'Copy',
  className = '',
  onCopy,
}: {
  text: string;
  label?: string;
  className?: string;
  onCopy?: (content: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.(text);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      onCopy?.(text);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text, onCopy]);

  return (
    <Button
      size="sm"
      disabled={!text.trim()}
      className={`transition-all duration-200 ${
        copied
          ? 'bg-[#00FF88]/20 text-[#00FF88] border border-[#00FF88]/40'
          : 'bg-gradient-to-r from-[#00F0FF]/20 to-[#FF2D78]/20 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40'
      } ${className}`}
      onClick={handleCopy}
    >
      {copied ? (
        <><Check className="w-4 h-4 mr-1" /> Copied!</>
      ) : (
        <><Copy className="w-4 h-4 mr-1" /> {label}</>
      )}
    </Button>
  );
}

// ---- Mini Calendar ----

function MiniCalendar({ items }: { items: ContentPlanItem[] }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  // Build map: day-of-month -> count of scheduled posts
  const dayCountMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of items) {
      if (!item.scheduled_at) continue;
      const d = new Date(item.scheduled_at);
      if (d.getFullYear() === year && d.getMonth() === month) {
        map.set(d.getDate(), (map.get(d.getDate()) || 0) + 1);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, monthOffset]);

  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <Card className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-[var(--ag-text-primary)] flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[var(--ag-cyan)]" />
            Content Calendar
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0" onClick={() => setMonthOffset((o) => o - 1)}>
              <ChevronLeft className="w-4 h-4 text-[var(--ag-text-muted)]" />
            </Button>
            <span className="text-xs text-[var(--ag-text-muted)] min-w-[120px] text-center">{monthLabel}</span>
            <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0" onClick={() => setMonthOffset((o) => o + 1)}>
              <ChevronRight className="w-4 h-4 text-[var(--ag-text-muted)]" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdays.map((d) => (
            <div key={d} className="text-center text-[10px] text-[var(--ag-text-muted)] font-medium py-1">{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty leading cells */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const count = dayCountMap.get(day) || 0;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            return (
              <div
                key={day}
                className={`aspect-square rounded-md flex flex-col items-center justify-center text-[11px] relative transition-colors ${
                  isToday
                    ? 'bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[var(--ag-cyan)] font-bold'
                    : count > 0
                      ? 'bg-[#00FF88]/5 text-[var(--ag-text-primary)]'
                      : 'text-[var(--ag-text-muted)]'
                }`}
              >
                {day}
                {count > 0 && (
                  <span className="absolute bottom-0.5 text-[8px] font-bold text-[#00FF88]">{count}</span>
                )}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[var(--ag-border-subtle)]">
          <span className="flex items-center gap-1 text-[10px] text-[var(--ag-text-muted)]">
            <span className="w-2 h-2 rounded-sm bg-[#00F0FF]/40" /> Today
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--ag-text-muted)]">
            <span className="w-2 h-2 rounded-sm bg-[#00FF88]/40" /> Scheduled
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Stats Summary Bar ----

function StatsSummary({ accounts, items }: { accounts: SocialAccount[]; items: ContentPlanItem[] }) {
  const totalPosts = accounts.reduce((sum, a) => sum + a.posts_count, 0);
  const activeAccounts = accounts.filter((a) => a.status === 'active').length;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const postsThisWeek = items.filter((i) => i.posted_at && new Date(i.posted_at) >= weekAgo).length;
  const scheduledCount = items.filter((i) => i.status === 'scheduled').length;

  const stats = [
    { label: 'Active Accounts', value: activeAccounts, icon: Users, color: '#00FF88' },
    { label: 'Total Posts', value: totalPosts, icon: Megaphone, color: '#00F0FF' },
    { label: 'This Week', value: postsThisWeek, icon: TrendingUp, color: '#FFB800' },
    { label: 'Scheduled', value: scheduledCount, icon: Clock, color: '#8B5CF6' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)]">
          <CardContent className="p-3 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${s.color}15` }}
            >
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--ag-text-primary)] leading-none">{s.value}</p>
              <p className="text-[10px] text-[var(--ag-text-muted)] mt-0.5">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- Accounts Tab ----

function AccountsTab() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Form state
  const [platform, setPlatform] = useState<string>('instagram');
  const [accountName, setAccountName] = useState('');
  const [postingMethod, setPostingMethod] = useState<string>('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [pageId, setPageId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadAccounts = async () => {
    try {
      const res = await socialMediaService.getAccounts();
      setAccounts(res.data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await socialMediaService.createAccount({
        platform,
        account_name: accountName,
        posting_method: postingMethod,
        webhook_url: postingMethod === 'webhook' ? webhookUrl : undefined,
        page_id: postingMethod === 'api' ? pageId : undefined,
        access_token: postingMethod === 'api' ? accessToken : undefined,
      });
      setShowForm(false);
      setAccountName('');
      setWebhookUrl('');
      setPageId('');
      setAccessToken('');
      loadAccounts();
    } catch {
      setSaveError('Failed to save account. Please check your details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await socialMediaService.deleteAccount(id);
      loadAccounts();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await socialMediaService.testAccount(id);
      setTestResult({ id, ...res.data });
    } catch {
      setTestResult({ id, success: false, message: 'Test request failed' });
    } finally {
      setTesting(null);
    }
  };

  const handleToggleStatus = async (account: SocialAccount) => {
    try {
      await socialMediaService.updateAccount(account.id, {
        status: account.status === 'active' ? 'paused' : 'active',
      });
      loadAccounts();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ag-cyan)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--ag-text-muted)]">Connect your social media accounts for automated posting.</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-[#00F0FF]/10 text-[var(--ag-cyan)] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/20">
          <Plus className="w-4 h-4 mr-1" /> Add Account
        </Button>
      </div>

      {/* Add Account Form */}
      {showForm && (
        <Card className="bg-[var(--ag-bg-surface)] border-[#00F0FF]/20">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Platform</label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="bg-[#06060B] border-[var(--ag-border-subtle)]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Account Name</label>
                <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="My Business Account" className="bg-[#06060B] border-[var(--ag-border-subtle)]" />
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Posting Method</label>
              <Select value={postingMethod} onValueChange={setPostingMethod}>
                <SelectTrigger className="bg-[#06060B] border-[var(--ag-border-subtle)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="api">Direct API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {postingMethod === 'webhook' && (
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Webhook URL</label>
                <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-webhook.example.com/post" className="bg-[#06060B] border-[var(--ag-border-subtle)]" />
              </div>
            )}

            {postingMethod === 'api' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Page ID</label>
                  <Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="Page/Account ID" className="bg-[#06060B] border-[var(--ag-border-subtle)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Access Token</label>
                  <Input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Long-lived access token" className="bg-[#06060B] border-[var(--ag-border-subtle)]" />
                </div>
              </div>
            )}

            {saveError && (
              <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{saveError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => { setShowForm(false); setSaveError(''); }}>Cancel</Button>
              <Button size="sm" className="min-h-[44px]" onClick={handleCreate} disabled={saving || !accountName}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Cards */}
      {accounts.length === 0 && !showForm && (
        <div className="text-center py-12 px-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF2D78]/10 to-[#00F0FF]/10 border border-[var(--ag-border-subtle)] flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-[#FF2D78] opacity-40" />
          </div>
          <p className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">No social accounts connected</p>
          <p className="text-xs text-[var(--ag-text-muted)] max-w-xs mx-auto mb-4">
            Connect your Instagram or Facebook to start auto-posting AI-generated content on schedule.
          </p>
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="bg-[#00F0FF]/10 text-[var(--ag-cyan)] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/20"
          >
            <Plus className="w-4 h-4 mr-1" /> Connect Account
          </Button>
        </div>
      )}

      <div className="grid gap-3">
        {accounts.map((account) => (
          <Card key={account.id} className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] hover:border-[#00F0FF]/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {/* Platform icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: account.platform === 'instagram'
                      ? 'linear-gradient(135deg, #833AB4, #FD1D1D, #FCAF45)'
                      : '#1877F2',
                  }}
                >
                  {account.platform === 'instagram' ? (
                    <Instagram className="w-5 h-5 text-white" />
                  ) : (
                    <Facebook className="w-5 h-5 text-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--ag-text-primary)] truncate">{account.account_name}</span>
                    <StatusBadge status={account.status} />
                    <Badge variant="outline" className="text-xs text-[var(--ag-text-muted)] border-[var(--ag-border-subtle)]">
                      {account.posting_method === 'webhook' ? <Webhook className="w-3 h-3 mr-1" /> : <Key className="w-3 h-3 mr-1" />}
                      {account.posting_method}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--ag-text-muted)]">
                    <span>{account.posts_count} posts</span>
                    {account.last_post_at && (
                      <span>Last: {new Date(account.last_post_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => handleToggleStatus(account)} aria-label={account.status === 'active' ? 'Pause ' + account.account_name : 'Activate ' + account.account_name}>
                    {account.status === 'active' ? <ToggleRight className="w-4 h-4 text-[#00FF88]" /> : <ToggleLeft className="w-4 h-4 text-[var(--ag-text-muted)]" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => handleTest(account.id)} disabled={testing === account.id} aria-label={'Test ' + account.account_name}>
                    {testing === account.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-[var(--ag-cyan)]" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => handleDelete(account.id)} aria-label={'Delete ' + account.account_name}>
                    <Trash2 className="w-4 h-4 text-[#FF6161]" />
                  </Button>
                </div>
              </div>

              {/* Test result */}
              {testResult && testResult.id === account.id && (
                <div className={`mt-2 p-2 rounded-lg text-xs ${testResult.success ? 'bg-[#00FF88]/10 text-[#00FF88]' : 'bg-[#FF6161]/10 text-[#FF6161]'}`}>
                  {testResult.success ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
                  {testResult.message}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---- Content Plan Tab ----

function ContentPlanTab() {
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [activePlan, setActivePlan] = useState<ContentPlan | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Generate form
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('');

  // Activate form
  const [showActivate, setShowActivate] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [activating, setActivating] = useState(false);

  // Editing state
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editMediaId, setEditMediaId] = useState('');

  // Posting
  const [postingItem, setPostingItem] = useState<string | null>(null);

  // Post composer state
  const [composerText, setComposerText] = useState('');
  const [composerTone, setComposerTone] = useState<Tone>('informative');
  const [composerPlatform, setComposerPlatform] = useState<Platform>('twitter');
  const [showComposer, setShowComposer] = useState(false);
  const [composerTopic, setComposerTopic] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  const loadData = async () => {
    try {
      const [plansRes, accountsRes] = await Promise.all([
        socialMediaService.getPlans(),
        socialMediaService.getAccounts(),
      ]);
      setPlans(plansRes.data);
      setAccounts(accountsRes.data);

      // Load first plan details if exists
      if (plansRes.data.length > 0) {
        const planRes = await socialMediaService.getPlan(plansRes.data[0].id);
        setActivePlan(planRes.data);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [plansRes, accountsRes] = await Promise.all([
          socialMediaService.getPlans(),
          socialMediaService.getAccounts(),
        ]);
        if (cancelled) return;
        setPlans(plansRes.data);
        setAccounts(accountsRes.data);
        if (plansRes.data.length > 0) {
          const planRes = await socialMediaService.getPlan(plansRes.data[0].id);
          if (!cancelled) setActivePlan(planRes.data);
        }
      } catch {
        // handled
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await socialMediaService.generatePlan(topic, niche);
      setActivePlan(res.data);
      setTopic('');
      setNiche('');
      loadData();
    } catch (err) {
      console.error('Failed to generate plan:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleActivate = async () => {
    if (!activePlan || !startDate || !selectedAccountId) return;
    setActivating(true);
    try {
      const res = await socialMediaService.activatePlan(activePlan.id, {
        start_date: startDate,
        social_account_id: selectedAccountId,
      });
      setActivePlan(res.data);
      setShowActivate(false);
      loadData();
    } catch (err) {
      console.error('Failed to activate plan:', err);
    } finally {
      setActivating(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!activePlan) return;
    try {
      await socialMediaService.deletePlan(activePlan.id);
      setActivePlan(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  };

  const handleSaveItem = async (item: ContentPlanItem) => {
    try {
      await socialMediaService.updatePlanItem(item.plan_id, item.id, {
        caption: editCaption,
        media_id: editMediaId || undefined,
      });
      setEditingItem(null);
      // Reload plan
      if (activePlan) {
        const res = await socialMediaService.getPlan(activePlan.id);
        setActivePlan(res.data);
      }
    } catch (err) {
      console.error('Failed to update item:', err);
    }
  };

  const handleToggleItem = async (item: ContentPlanItem) => {
    try {
      await socialMediaService.updatePlanItem(item.plan_id, item.id, {
        enabled: !item.enabled,
      });
      if (activePlan) {
        const res = await socialMediaService.getPlan(activePlan.id);
        setActivePlan(res.data);
      }
    } catch (err) {
      console.error('Failed to toggle item:', err);
    }
  };

  const handlePostNow = async (item: ContentPlanItem) => {
    setPostingItem(item.id);
    try {
      await socialMediaService.postItem(item.plan_id, item.id);
      if (activePlan) {
        const res = await socialMediaService.getPlan(activePlan.id);
        setActivePlan(res.data);
      }
    } catch (err) {
      console.error('Manual post failed:', err);
    } finally {
      setPostingItem(null);
    }
  };

  const selectPlan = async (plan: ContentPlan) => {
    try {
      const res = await socialMediaService.getPlan(plan.id);
      setActivePlan(res.data);
    } catch (err) {
      console.error('Failed to load plan:', err);
    }
  };

  const handleAiGenerate = async () => {
    if (!composerTopic.trim()) return;
    setAiGenerating(true);
    setAiError('');
    try {
      const platformLabel = PLATFORMS.find((p) => p.value === composerPlatform)?.label ?? composerPlatform;
      const formatGuide =
        composerPlatform === 'twitter'
          ? 'under 280 characters, 3-5 hashtags'
          : composerPlatform === 'linkedin'
            ? 'professional, 150-300 words, line breaks for readability'
            : 'engaging caption, 20-30 hashtags';

      const prompt = [
        `Generate a ${platformLabel} post about: ${composerTopic}`,
        `Tone: ${composerTone}`,
        `Include: relevant hashtags, emoji where appropriate`,
        `Format: ${formatGuide}`,
        `IMPORTANT: Return ONLY the post text. No preamble, no explanation, no quotes around it.`,
      ].join('\n');

      const res = await agentService.chat(prompt, 'social');
      const generated = res.data.text?.trim();
      if (generated) {
        setComposerText(generated);
        setComposerTopic('');
      } else {
        setAiError('AI returned empty content. Try a different topic.');
      }
    } catch {
      setAiError('Failed to generate content. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  /** Format post text for platform-specific clipboard copy */
  const formatForPlatform = useCallback((text: string, platform: Platform): string => {
    if (platform === 'twitter') {
      // Twitter: keep compact, ensure hashtags are at the end
      return text.trim();
    }
    if (platform === 'linkedin') {
      // LinkedIn: ensure line breaks are preserved as double newlines for readability
      return text.trim().replace(/\n{3,}/g, '\n\n');
    }
    // Instagram: just trim
    return text.trim();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ag-cyan)]" />
      </div>
    );
  }

  // No plan view — show generator + post composer
  if (!activePlan) {
    return (
      <div className="space-y-4">
        {/* Enhanced empty state when no plans and composer hidden */}
        {plans.length === 0 && !showComposer && (
          <div className="text-center py-10 px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00F0FF]/10 to-[#FF2D78]/10 border border-[#00F0FF]/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-[var(--ag-cyan)]" />
            </div>
            <h3 className="text-base font-semibold text-[var(--ag-text-primary)] mb-1">Create your first social media post</h3>
            <p className="text-sm text-[var(--ag-text-muted)] max-w-md mx-auto mb-4">
              Describe your topic and I'll write 3 variations for different platforms, or generate a full 10-day content plan.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                size="sm"
                onClick={() => setShowComposer(true)}
                className="bg-[#00F0FF]/10 text-[var(--ag-cyan)] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/20"
              >
                <Wand2 className="w-4 h-4 mr-1" /> Quick Post
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {}}
                className="text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]"
              >
                <CalendarDays className="w-4 h-4 mr-1" /> Generate Plan
              </Button>
            </div>
          </div>
        )}

        {/* Post Composer */}
        {(showComposer || plans.length > 0) && (
          <Card className="bg-[var(--ag-bg-surface)] border-[#00F0FF]/20 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--ag-text-primary)] flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-[var(--ag-cyan)]" />
                Quick Post Composer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Tone selector */}
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1.5 block">Tone</label>
                <TonePills selected={composerTone} onChange={setComposerTone} />
              </div>

              {/* Platform selector */}
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1.5 block">Platform</label>
                <PlatformBadges selected={composerPlatform} onChange={setComposerPlatform} />
              </div>

              {/* AI Generate section */}
              <div className="p-3 rounded-lg bg-[#06060B] border border-[var(--ag-border-subtle)] space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--ag-cyan)]" />
                  <span className="text-xs font-medium text-[var(--ag-text-muted)]">AI Generate</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={composerTopic}
                    onChange={(e) => setComposerTopic(e.target.value)}
                    placeholder="Describe your topic (e.g., AI productivity tips for developers)"
                    className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] text-sm flex-1"
                    onKeyDown={(e) => { if (e.key === 'Enter' && composerTopic.trim() && !aiGenerating) handleAiGenerate(); }}
                    disabled={aiGenerating}
                  />
                  <Button
                    size="sm"
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !composerTopic.trim()}
                    className="bg-gradient-to-r from-[#00F0FF]/20 to-[#8B5CF6]/20 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40 whitespace-nowrap min-h-[44px]"
                  >
                    {aiGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-1" /> Generate Post</>
                    )}
                  </Button>
                </div>
                {aiError && (
                  <p className="text-xs text-[#FF6161] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{aiError}
                  </p>
                )}
              </div>

              {/* Textarea */}
              <div>
                <Textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  placeholder={`Write your ${composerTone} post for ${PLATFORMS.find((p) => p.value === composerPlatform)?.label}, or use AI Generate above...`}
                  className="bg-[#06060B] border-[var(--ag-border-subtle)] text-sm min-h-[100px] focus:border-[#00F0FF]/30"
                  disabled={aiGenerating}
                />
                <CharacterCounter count={composerText.length} platform={composerPlatform} />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <CopyButton
                  text={formatForPlatform(composerText, composerPlatform)}
                  label={`Copy for ${PLATFORMS.find((p) => p.value === composerPlatform)?.label}`}
                />
                {composerPlatform === 'twitter' && composerText.length > 280 && (
                  <Badge variant="outline" className="text-xs text-[#FFB800] border-[#FFB800]/30 py-1">
                    <Scissors className="w-3 h-3 mr-1" /> Thread mode active
                  </Badge>
                )}
                {showComposer && plans.length === 0 && (
                  <Button size="sm" variant="ghost" onClick={() => { setShowComposer(false); setComposerText(''); setComposerTopic(''); setAiError(''); }}>
                    Cancel
                  </Button>
                )}
              </div>

              {/* Thread composer for Twitter when over 280 chars */}
              {composerPlatform === 'twitter' && composerText.length > 280 && (
                <ThreadComposer text={composerText} onCopy={() => {}} />
              )}

              {/* Post preview */}
              <PostPreviewCard text={composerText} platform={composerPlatform} />

              {/* Hashtag suggestions */}
              <HashtagSuggestions text={composerText} />
            </CardContent>
          </Card>
        )}

        {/* Content plan generator */}
        <Card className="bg-[var(--ag-bg-surface)] border-[#00F0FF]/20">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--ag-text-primary)] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#FF2D78]" />
              Generate 10-Day Content Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Topic</label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., AI tools for developers" className="bg-[#06060B] border-[var(--ag-border-subtle)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Niche</label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g., Tech startups" className="bg-[#06060B] border-[var(--ag-border-subtle)]" />
            </div>
            <Button onClick={handleGenerate} disabled={generating || !topic || !niche} className="w-full bg-gradient-to-r from-[#00F0FF]/20 to-[#FF2D78]/20 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40">
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Plan</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Existing plans */}
        {plans.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--ag-text-primary)] mb-2">Existing Plans</h3>
            <div className="grid gap-2">
              {plans.map((plan) => (
                <button key={plan.id} onClick={() => selectPlan(plan)} className="w-full text-left p-3 min-h-[44px] rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] hover:border-[#00F0FF]/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--ag-text-primary)]">{plan.title}</span>
                    <StatusBadge status={plan.status} />
                  </div>
                  <span className="text-xs text-[var(--ag-text-muted)]">{new Date(plan.created_at).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Plan detail view
  const items = activePlan.items || [];
  const dayGroups = new Map<number, ContentPlanItem[]>();
  for (const item of items) {
    const existing = dayGroups.get(item.day_number) || [];
    existing.push(item);
    dayGroups.set(item.day_number, existing);
  }

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <Card className="bg-[var(--ag-bg-surface)] border-[#00F0FF]/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-medium text-[var(--ag-text-primary)]">{activePlan.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={activePlan.status} />
                <span className="text-xs text-[var(--ag-text-muted)]">{items.length} items</span>
                {activePlan.start_date && (
                  <span className="text-xs text-[var(--ag-text-muted)]">Starts: {new Date(activePlan.start_date).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {activePlan.status === 'draft' && (
                <Button size="sm" onClick={() => setShowActivate(!showActivate)} className="min-h-[44px] bg-[#00FF88]/10 text-[#00FF88] hover:bg-[#00FF88]/20 border border-[#00FF88]/20">
                  <Calendar className="w-4 h-4 mr-1" /> Activate
                </Button>
              )}
              <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => { setActivePlan(null); loadData(); }}>
                Back
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDeletePlan} className="text-[#FF6161] min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" aria-label="Delete plan">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Activate form */}
          {showActivate && (
            <div className="mt-3 p-3 rounded-lg bg-[#06060B] border border-[var(--ag-border-subtle)] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Start Date</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Social Account</label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)]"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.account_name} ({a.platform})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={handleActivate} disabled={activating || !startDate || !selectedAccountId}>
                {activating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                Activate Schedule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mini Calendar — shows scheduled posts by day */}
      {items.some((i) => i.scheduled_at) && <MiniCalendar items={items} />}

      {/* Day cards */}
      {Array.from(dayGroups.entries()).sort(([a], [b]) => a - b).map(([dayNum, dayItems]) => (
        <Card key={dayNum} className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--ag-cyan)]">Day {dayNum}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dayItems.map((item) => (
              <div key={item.id} className={`p-3 rounded-lg border transition-colors ${item.enabled ? 'bg-[#06060B] border-[var(--ag-border-subtle)]' : 'bg-[#06060B]/50 border-[var(--ag-border-subtle)]/50 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--ag-text-muted)]">Slot {item.slot}</span>
                    <StatusIcon status={item.status} />
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={!!item.enabled} onCheckedChange={() => handleToggleItem(item)} />
                    {editingItem === item.id ? (
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => handleSaveItem(item)} aria-label="Save changes">
                        <CheckCircle className="w-4 h-4 text-[#00FF88]" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => { setEditingItem(item.id); setEditCaption(item.caption); setEditMediaId(item.media_id); }} aria-label="Edit item">
                        <Edit3 className="w-4 h-4 text-[var(--ag-text-muted)]" />
                      </Button>
                    )}
                    {item.enabled && activePlan.status === 'active' && item.status !== 'posted' && (
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => handlePostNow(item)} disabled={postingItem === item.id} aria-label="Post now">
                        {postingItem === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-[var(--ag-cyan)]" />}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Caption */}
                {editingItem === item.id ? (
                  <div className="space-y-2">
                    <Textarea value={editCaption} onChange={(e) => setEditCaption(e.target.value)} className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] text-sm min-h-[80px]" maxLength={2200} />
                    <div className="flex items-center gap-2">
                      <Input value={editMediaId} onChange={(e) => setEditMediaId(e.target.value)} placeholder="Media ID (img-xxx or vid-xxx)" className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] text-xs flex-1" />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--ag-text-primary)] whitespace-pre-wrap">{item.caption}</p>
                )}

                {/* Media preview */}
                {item.media_id && editingItem !== item.id && (
                  <div className="mt-2 flex items-center gap-2">
                    {item.media_type === 'image' ? <Image className="w-4 h-4 text-[var(--ag-cyan)]" /> : item.media_type === 'video' ? <Film className="w-4 h-4 text-[#FFB800]" /> : null}
                    <span className="text-xs text-[var(--ag-text-muted)] font-mono">{item.media_id}</span>
                    {item.media_url && (
                      <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--ag-cyan)] hover:underline">
                        <Eye className="w-3 h-3 inline mr-1" />preview
                      </a>
                    )}
                  </div>
                )}

                {/* Scheduled time */}
                {item.scheduled_at && (
                  <div className="mt-1 text-xs text-[var(--ag-text-muted)]">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(item.scheduled_at).toLocaleString()}
                  </div>
                )}

                {/* Error message */}
                {item.error_message && (
                  <div className="mt-1 text-xs text-[#FF6161]">
                    <XCircle className="w-3 h-3 inline mr-1" />{item.error_message}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- Posts Tab ----

function PostsTab() {
  const [allItems, setAllItems] = useState<ContentPlanItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await socialMediaService.getPlans();

        // Load all plan items in parallel
        const planResponses = await Promise.all(res.data.map(plan => socialMediaService.getPlan(plan.id)));
        const items: ContentPlanItem[] = planResponses.flatMap(planRes => planRes.data.items?.filter(i => i.status !== 'draft') ?? []);
        setAllItems(items.sort((a, b) => {
          const aTime = a.scheduled_at || a.created_at;
          const bTime = b.scheduled_at || b.created_at;
          return bTime.localeCompare(aTime);
        }));
      } catch (err) {
        console.error('Failed to load posts:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ag-cyan)]" />
      </div>
    );
  }

  const filtered = filter === 'all' ? allItems : allItems.filter(i => i.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'scheduled', 'posted', 'failed'].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'ghost'} onClick={() => setFilter(f)} className={filter === f ? 'bg-[#00F0FF]/20 text-[var(--ag-cyan)]' : 'text-[var(--ag-text-muted)]'}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1 text-xs opacity-60">({allItems.filter(i => f === 'all' || i.status === f).length})</span>
            )}
          </Button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00F0FF]/10 to-[#8B5CF6]/10 border border-[var(--ag-border-subtle)] flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-7 h-7 text-[var(--ag-cyan)] opacity-40" />
          </div>
          <p className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">No posts to show</p>
          <p className="text-xs text-[var(--ag-text-muted)] max-w-xs mx-auto">
            {filter === 'all'
              ? 'Generate a content plan and activate it to start scheduling posts.'
              : `No ${filter} posts yet. Switch to "All" to see everything.`}
          </p>
        </div>
      )}

      <div className="grid gap-2">
        {filtered.map((item) => (
          <Card key={item.id} className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)]">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <StatusIcon status={item.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-[var(--ag-text-muted)]">Day {item.day_number}</span>
                    <StatusBadge status={item.status} />
                    {item.media_type && (
                      <Badge variant="outline" className="text-xs text-[var(--ag-text-muted)] border-[var(--ag-border-subtle)]">
                        {item.media_type === 'image' ? <Image className="w-3 h-3 mr-1" /> : <Film className="w-3 h-3 mr-1" />}
                        {item.media_type}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-[var(--ag-text-primary)] mt-1 line-clamp-2">{item.caption}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--ag-text-muted)]">
                    {item.scheduled_at && <span><Clock className="w-3 h-3 inline mr-1" />{new Date(item.scheduled_at).toLocaleString()}</span>}
                    {item.posted_at && <span><CheckCircle className="w-3 h-3 inline mr-1" />Posted {new Date(item.posted_at).toLocaleString()}</span>}
                  </div>
                  {item.error_message && (
                    <p className="text-xs text-[#FF6161] mt-1"><XCircle className="w-3 h-3 inline mr-1" />{item.error_message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---- Main Page ----

export function SocialMediaPage() {
  const [statsAccounts, setStatsAccounts] = useState<SocialAccount[]>([]);
  const [statsItems, setStatsItems] = useState<ContentPlanItem[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [accountsRes, plansRes] = await Promise.all([
          socialMediaService.getAccounts(),
          socialMediaService.getPlans(),
        ]);
        setStatsAccounts(accountsRes.data);

        if (plansRes.data.length > 0) {
          const planResponses = await Promise.all(
            plansRes.data.map((plan) => socialMediaService.getPlan(plan.id))
          );
          const allItems = planResponses.flatMap((r) => r.data.items ?? []);
          setStatsItems(allItems);
        }
      } catch {
        // Stats are best-effort, don't block the page
      } finally {
        setStatsLoaded(true);
      }
    };
    loadStats();
  }, []);

  return (
    <PageShell maxWidth="4xl">
    <div className="space-y-6 pb-24 md:pb-6 overflow-x-hidden">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF2D78]/20 to-[#00F0FF]/20 border border-[#FF2D78]/20 flex items-center justify-center">
          <Share2 className="w-5 h-5 text-[#FF2D78]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--ag-text-primary)]">Social Media Handler <span className="text-[10px] text-[#4B5563] font-medium ml-1.5">📱 Powered by Weebo</span></h1>
          <p className="text-sm text-[var(--ag-text-muted)]">Connect accounts, generate content plans, and auto-post on schedule.</p>
        </div>
      </div>

      {/* Stats summary bar */}
      {statsLoaded && (statsAccounts.length > 0 || statsItems.length > 0) && (
        <StatsSummary accounts={statsAccounts} items={statsItems} />
      )}

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)]">
          <TabsTrigger value="accounts" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[var(--ag-cyan)]">Accounts</TabsTrigger>
          <TabsTrigger value="plan" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[var(--ag-cyan)]">Content Plan</TabsTrigger>
          <TabsTrigger value="posts" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[var(--ag-cyan)]">Posts</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          <AccountsTab />
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          <ContentPlanTab />
        </TabsContent>

        <TabsContent value="posts" className="mt-4">
          <PostsTab />
        </TabsContent>
      </Tabs>
    </div>
    </PageShell>
  );
}
