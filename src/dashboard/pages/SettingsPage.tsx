import { useState, useEffect } from 'react';
import { PageShell, PageHeader } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import {
  User,
  Bell,
  Shield,
  Globe,
  Mail,
  Smartphone,
  Key,
  Save,
  Sparkles,
  Eye,
  Palette,
  Plus,
  Trash2,
  Brain,
  Tag,
  Clock,
  Loader2,
  Monitor,
  LogOut,
  Download,
  Users,
  CalendarDays,
  Moon,
  Sun,
  RotateCcw,
  Mic,
  Volume2,
  MapPin,
  FileDown,
  Laptop,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { userService, apiKeyService, memoryService, agentService, versionService, modelService, authService, type UserSession } from '@/services/api';
import type { ApiProvider, MemoryEntry, FreeModel } from '@/types';

export function SettingsPage() {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // 57.9: toast shown after silent agent config saves
  const [savedToast, setSavedToast] = useState(false);
  const showSavedToast = () => { setSavedToast(true); setTimeout(() => setSavedToast(false), 2000); };
  const [isExportingConversations, setIsExportingConversations] = useState(false);
  const [isExportingMarkdown, setIsExportingMarkdown] = useState(false);
  const [isExportingMarkdown7Days, setIsExportingMarkdown7Days] = useState(false);
  const [isExportingGDPR, setIsExportingGDPR] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  // Timezone auto-detection
  const [detectedTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
  });

  // Voice settings (localStorage key: agentin_voice_settings)
  const [voiceSettings, setVoiceSettings] = useState(() => {
    try {
      const raw = localStorage.getItem('agentin_voice_settings');
      if (raw) return JSON.parse(raw) as { enabled: boolean; rate: number; lang: string };
    } catch {}
    return { enabled: false, rate: 1, lang: 'en-US' };
  });
  const [ttsSample, setTtsSample] = useState(false);

  const saveVoiceSettings = (patch: Partial<typeof voiceSettings>) => {
    setVoiceSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem('agentin_voice_settings', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleTestVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('Hello! I am your Agentin AI assistant. How can I help you today?');
    u.rate = voiceSettings.rate;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === voiceSettings.lang) || voices.find((v) => v.lang.startsWith('en')) || null;
    if (voice) u.voice = voice;
    u.onstart = () => setTtsSample(true);
    u.onend = () => setTtsSample(false);
    u.onerror = () => setTtsSample(false);
    window.speechSynthesis.speak(u);
  };
  // 60.4: keyboard shortcut cheat sheet
  const [showShortcuts, setShowShortcuts] = useState(false);
  const user = useAuthStore((s) => s.user);
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'weebo', page: 'settings' });
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    versionService.get().then(({ data }) => setAppVersion(data.version)).catch(() => {});
    // 38.2: Load real notif preferences from server on mount
    agentService.getConfig().then(({ data }) => {
      setAgentNotifs({
        notif_reminders: data.notif_reminders ?? 1,
        notif_escalations: data.notif_escalations ?? 1,
        notif_agents: data.notif_agents ?? 1,
        notif_daily_briefing: data.notif_daily_briefing ?? 1,
        notif_connections: data.notif_connections ?? 1,
      });
      // 39.4: preferred free model
      if (data.preferred_free_model) setPreferredFreeModel(data.preferred_free_model as string);
      // 41.6: snooze presets
      if (data.snooze_presets) {
        try { setSnoozePresets(JSON.parse(data.snooze_presets as string) as string[]); } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, []);
  const setUser = useAuthStore((s) => s.setUser);
  const compactMode = useAuthStore((s) => s.compactMode);
  const setCompactMode = useAuthStore((s) => s.setCompactMode);
  const { mode: themeMode, accentColor, accentPresets, setMode: setThemeMode, setAccentColor, setBackground } = useThemeStore();


  const [profile, setProfile] = useState({
    name: user?.name ?? user?.email?.split('@')[0] ?? '',
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || '',
    avatar: user?.avatar || '',
  });

  const [notifications, setNotifications] = useState({
    emailReminders: user?.notifications?.email ?? true,
    pushNotifications: user?.notifications?.push ?? false,
    weeklyDigest: user?.notifications?.weeklyDigest ?? true,
    marketingEmails: false,
    securityAlerts: user?.notifications?.agentUpdates ?? true,
    reminderNotifs: user?.notifications?.reminders ?? true,
    connectionAlerts: (user?.notifications as Record<string, boolean> | undefined)?.connections ?? true,
    weeklyDigestToggle: (user?.notifications as Record<string, boolean> | undefined)?.digest ?? true,
  });

  // Agent-level notification preferences (saved to agent_configs via PATCH /agent/config)
  const [agentNotifs, setAgentNotifs] = useState({
    notif_reminders: 1,
    notif_escalations: 1,
    notif_agents: 1,
    notif_daily_briefing: 1,
    notif_connections: 1,
  });
  // 41.6: snooze presets
  const [snoozePresets, setSnoozePresets] = useState<string[]>(['1h', 'tomorrow', 'next-week']);

  const [privacy, setPrivacy] = useState({
    showProfile: user?.privacy?.showProfile ?? true,
    showActivity: user?.privacy?.showActivity ?? true,
    allowAgentChat: user?.privacy?.allowAgentChat ?? true,
    showLocation: user?.privacy?.showLocation ?? true,
  });

  const [apiKeys, setApiKeys] = useState<{ id: string; provider: ApiProvider; label: string; maskedKey: string }[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState<ApiProvider>('openai');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showAddKey, setShowAddKey] = useState(false);
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [rotateValue, setRotateValue] = useState('');
  const [isRotating, setIsRotating] = useState(false);

  // AI Background Generator state
  const handleRevokeSession = async (sessionId: string) => {
    await userService.revokeSession(sessionId).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleSaveModel = async (model: string) => {
    setModelSaving(true);
    try {
      await userService.setPreferredModel(model);
      setPreferredModel(model);
    } catch {
      // ignore
    } finally {
      setModelSaving(false);
    }
  };

  const [bgVibe, setBgVibe] = useState('');
  const [bgPreview, setBgPreview] = useState<{ gradient: string; name: string; accent: string } | null>(null);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);

  // Memory state
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryFilter, setMemoryFilter] = useState<string>('all');
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [reactionSummary, setReactionSummary] = useState<{ reaction: string; count: number }[]>([]);
  // 60.2: Starred messages
  const [starredMessages, setStarredMessages] = useState<import('@/types').ConversationEntry[]>([]);
  const [showStarred, setShowStarred] = useState(false);

  // Load API keys from backend on mount
  useEffect(() => {
    apiKeyService.list().then(({ data }) => {
      setApiKeys(data.map(k => ({ id: k.id, provider: k.provider, label: k.label, maskedKey: k.maskedKey })));
    }).catch(() => {});
  }, []);

  // Session management state
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Model preference state
  const [preferredModel, setPreferredModel] = useState('auto');
  const [modelSaving, setModelSaving] = useState(false);
  // 39.4: preferred free model picker
  const [preferredFreeModel, setPreferredFreeModel] = useState('auto');
  const [freeModels, setFreeModels] = useState<FreeModel[]>([]);
  const [freeModelSaving, setFreeModelSaving] = useState(false);

  // 52.4: Change password form state
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // 82.8: Delete account state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  // Privacy save state
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Load memories and reaction summary when memory tab is active
  useEffect(() => {
    if (activeTab === 'memory') {
      memoryService.getReactionSummary().then(({ data }) => setReactionSummary(data.reactions)).catch(() => {});
      // 60.2: Load starred messages
      agentService.getStarred().then(({ data }) => setStarredMessages(data.messages)).catch(() => {});
      setMemoriesLoading(true);
      memoryService.list(memoryFilter === 'all' ? undefined : memoryFilter)
        .then(({ data }) => setMemories(data))
        .catch(() => {})
        .finally(() => setMemoriesLoading(false));
    }
  }, [activeTab, memoryFilter]);

  // Load sessions when sessions tab is active
  useEffect(() => {
    if (activeTab === 'sessions') {
      setSessionsLoading(true);
      userService.getSessions()
        .then(({ data }) => setSessions(data.sessions))
        .catch(() => {})
        .finally(() => setSessionsLoading(false));
    }
  }, [activeTab]);

  // Load model preference when security tab is active
  useEffect(() => {
    if (activeTab === 'security') {
      userService.getPreferredModel()
        .then(({ data }) => setPreferredModel(data.preferredModel))
        .catch(() => {});
      // 39.4: Load available free models for picker
      modelService.getFreeModels()
        .then(({ data }) => setFreeModels(data.models.filter((m) => m.status === 'active' || m.status === 'new')))
        .catch(() => {});
    }
  }, [activeTab]);


  const handleExportConversations = async () => {
    setIsExportingConversations(true);
    try {
      const { data } = await memoryService.getConversationsExport(1000);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentin-conversations-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent — export is best-effort
    } finally {
      setIsExportingConversations(false);
    }
  };

  const handleExportMarkdown7Days = async () => {
    setIsExportingMarkdown7Days(true);
    try {
      const { data } = await memoryService.getConversationsMarkdownExport7Days();
      const blob = new Blob([data as unknown as string], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentin-chat-7days-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent — export is best-effort
    } finally {
      setIsExportingMarkdown7Days(false);
    }
  };

  const handleExportMarkdown = async () => {
    setIsExportingMarkdown(true);
    try {
      const { data } = await memoryService.getConversationsMarkdownExport();
      const blob = new Blob([data as unknown as string], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentin-chat-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent — export is best-effort
    } finally {
      setIsExportingMarkdown(false);
    }
  };

  // GDPR: Download all user data
  const handleGDPRExport = async () => {
    setIsExportingGDPR(true);
    try {
      // Aggregate all user data: profile, conversations, memories, reminders
      const results = await Promise.allSettled([
        userService.getProfile(),
        memoryService.getConversationsExport(5000),
        memoryService.list(),
        userService.getSessions(),
      ]);
      const profileData = results[0].status === 'fulfilled' ? results[0].value.data : null;
      const conversations = results[1].status === 'fulfilled' ? results[1].value.data : [];
      const memoriesData = results[2].status === 'fulfilled' ? results[2].value.data : [];
      const sessionsData = results[3].status === 'fulfilled' ? results[3].value.data : { sessions: [] };

      const gdprBundle = {
        exportedAt: new Date().toISOString(),
        format: 'GDPR Data Export - Agentin Chat',
        profile: profileData,
        conversations,
        memories: memoriesData,
        sessions: sessionsData.sessions,
      };

      const blob = new Blob([JSON.stringify(gdprBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentin-gdpr-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent - best effort export
    } finally {
      setIsExportingGDPR(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await memoryService.delete(memoryId);
      setMemories(memories.filter(m => m.id !== memoryId));
    } catch {
      // keep local state
    }
  };

  const notificationFieldMap: Record<string, string> = {
    emailReminders: 'email',
    pushNotifications: 'push',
    weeklyDigest: 'weeklyDigest',
    securityAlerts: 'agentUpdates',
    reminderNotifs: 'reminders',
    connectionAlerts: 'connections',
    weeklyDigestToggle: 'digest',
  };

  const saveNotification = async (field: string, value: boolean) => {
    const serverKey = notificationFieldMap[field];
    if (!serverKey) return;
    try {
      await userService.updateProfile({ notifications: { [serverKey]: value } } as Parameters<typeof userService.updateProfile>[0]);
    } catch {
      // 57.3: Revert toggle state on server failure to prevent stale UI
      setNotifications((prev) => ({ ...prev, [field]: !value }));
    }
  };

  const handleGenerateBg = async () => {
    setIsGeneratingBg(true);
    try {
      const { data } = await agentService.generateBackground(bgVibe || undefined);
      setBgPreview(data);
    } catch {
      // ignore
    } finally {
      setIsGeneratingBg(false);
    }
  };

  const handleApplyBg = async () => {
    if (!bgPreview) return;
    setBackground(bgPreview.gradient);
    await userService.updateProfile({ theme_background: bgPreview.gradient } as Parameters<typeof userService.updateProfile>[0]);
  };

  // 46.4: beforeunload guard — warn when navigating away with unsaved profile changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // 60.4: global '?' key toggles keyboard shortcut cheat sheet
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        setShowShortcuts((v) => !v);
      }
      if (e.key === 'Escape') setShowShortcuts(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: updatedUser } = await userService.updateProfile(profile);
      if (user && updatedUser) {
        // Merge with existing user to preserve notifications, privacy, credits,
        // and any fields not returned by PATCH /me (server omits some on update)
        setUser({ ...user, ...updatedUser });
      }
      setHasUnsavedChanges(false);
      void notifyDone('Profile saved');
    } catch (err) {
      void err; // silently fail — form stays open with current values
      void notifyFail('Profile save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrivacySave = async () => {
    setSavingPrivacy(true);
    try {
      await userService.updateProfile({ privacy } as Parameters<typeof userService.updateProfile>[0]);
      showSavedToast();
      void notifyDone('Privacy settings saved');
    } catch {
      void notifyFail('Privacy save failed');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleAddKey = async () => {
    if (!newKeyValue) return;
    try {
      const { data } = await apiKeyService.create({
        provider: newKeyProvider,
        label: newKeyProvider.charAt(0).toUpperCase() + newKeyProvider.slice(1),
        key: newKeyValue,
      });
      setApiKeys([...apiKeys, { id: data.id, provider: data.provider, label: data.label, maskedKey: data.maskedKey }]);
    } catch {
      // Fallback: add locally
      const masked = newKeyValue.slice(0, 3) + '...' + newKeyValue.slice(-4);
      setApiKeys([...apiKeys, {
        id: Date.now().toString(),
        provider: newKeyProvider,
        label: newKeyProvider.charAt(0).toUpperCase() + newKeyProvider.slice(1),
        maskedKey: masked,
      }]);
    }
    setNewKeyValue('');
    setShowAddKey(false);
  };

  const handleRotateKey = async (id: string) => {
    if (!rotateValue.trim() || rotateValue.trim().length < 8) return;
    setIsRotating(true);
    try {
      const { data } = await apiKeyService.rotate(id, rotateValue.trim());
      setApiKeys(apiKeys.map(k => k.id === id ? { ...k, maskedKey: data.maskedKey } : k));
      setRotatingKeyId(null);
      setRotateValue('');
    } catch {
      // silently fail — UI state unchanged
    } finally {
      setIsRotating(false);
    }
  };

  // 59.10: Reset agent config to defaults
  const [isResettingAgent, setIsResettingAgent] = useState(false);
  const handleResetAgentConfig = async () => {
    setIsResettingAgent(true);
    try {
      const defaultNotifs = { notif_reminders: 1, notif_escalations: 1, notif_agents: 1, notif_daily_briefing: 1, notif_connections: 1 };
      const defaultPresets = ['1h', 'tomorrow', 'next-week'];
      const defaultModel = 'auto';
      await agentService.updateConfig({
        ...defaultNotifs,
        snooze_presets: JSON.stringify(defaultPresets),
        preferred_free_model: defaultModel,
      });
      setAgentNotifs(defaultNotifs);
      setSnoozePresets(defaultPresets);
      setPreferredFreeModel(defaultModel);
      showSavedToast();
    } catch { /* silently fail */ } finally { setIsResettingAgent(false); }
  };

  // 61.6: provider emoji logos
  const providerEmoji: Record<string, string> = {
    openai: '🤖',
    anthropic: '🅰',
    qwen: '🇨🇳',
    openrouter: '🔀',
    custom: '⚙️',
  };

  const providerColors: Record<string, string> = {
    openai: '#10a37f',
    anthropic: '#d4a574',
    qwen: '#6366f1',
    openrouter: '#ef4444',
    custom: '#8B5CF6',
  };

  return (
    <PageShell>
    <div data-testid="settings-page" className="space-y-6 animate-in fade-in duration-500 pb-24 md:pb-6">
      {/* 57.9: Agent config save-confirmation toast */}
      {savedToast && (
        <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 text-[#8B5CF6] text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="settings-saved-toast">
          <Save className="w-4 h-4" />
          Settings saved
        </div>
      )}

      {/* 60.4: Keyboard shortcut cheat sheet modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
          data-testid="shortcuts-modal"
        >
          <div
            className="bg-[var(--ag-bg-surface)] border border-[#8B5CF6]/30 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#F4F6FF]" style={{ fontFamily: 'Syne, sans-serif' }}>
                Keyboard Shortcuts
              </h2>
              <button onClick={() => setShowShortcuts(false)} className="text-[var(--ag-text-muted)] hover:text-[#F4F6FF] transition-colors text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close shortcuts">✕</button>
            </div>
            <div className="space-y-4">
              {[
                { group: 'Navigation', items: [
                  { key: '?', desc: 'Toggle this cheat sheet' },
                  { key: 'Esc', desc: 'Close modals / dialogs' },
                ]},
                { group: 'Reminders', items: [
                  { key: 'N', desc: 'New reminder (when on Reminders page)' },
                  { key: '/', desc: 'Focus search (when on Reminders page)' },
                ]},
                { group: 'Chat', items: [
                  { key: 'Enter', desc: 'Send message' },
                  { key: 'Shift + Enter', desc: 'New line in message' },
                ]},
                { group: 'Settings', items: [
                  { key: 'Ctrl + S', desc: 'Save profile changes' },
                ]},
              ].map(({ group, items }) => (
                <div key={group}>
                  <p className="text-xs uppercase tracking-widest text-[var(--ag-text-muted)] mb-1.5">{group}</p>
                  <div className="space-y-1">
                    {items.map(({ key, desc }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-[var(--ag-text-muted)] text-sm">{desc}</span>
                        <kbd className="px-2 py-0.5 rounded bg-[#1A1A2E] border border-[#8B5CF6]/20 text-[#8B5CF6] text-xs font-mono">{key}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[11px] text-[var(--ag-text-muted)] text-center">Press <kbd className="px-1.5 py-0.5 rounded bg-[#1A1A2E] border border-[#6B7280]/30 text-xs font-mono">?</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-[#1A1A2E] border border-[#6B7280]/30 text-xs font-mono">Esc</kbd> to close</p>
          </div>
        </div>
      )}
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Manage your account preferences"
        badge={
          <>
            <span className="relative flex h-2.5 w-2.5" title="Weebo active">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8B5CF6]" />
            </span>
            {hasUnsavedChanges && !isSaving && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                Unsaved
              </span>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShortcuts(true)}
              className="border-[rgba(139,92,246,0.15)] text-[#9CA3AF] hover:text-[#8B5CF6] hover:border-[#8B5CF6]/40 text-xs min-h-[44px]"
              title="Keyboard shortcuts (?)"
              data-testid="shortcuts-btn"
            >
              <kbd className="text-xs font-mono mr-1">?</kbd>Shortcuts
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gs-btn-primary min-h-[44px] press-scale focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50">
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Save Changes</>
              )}
            </Button>
          </div>
        }
      />

      {/* Section quick-nav — smooth-scrolls to each settings section */}
      <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1 -mb-2 whitespace-nowrap -webkit-overflow-scrolling-touch">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'security', label: 'Security', icon: Shield },
          { id: 'sessions', label: 'Sessions', icon: Laptop },
          { id: 'apikeys', label: 'API Keys', icon: Key },
          { id: 'memory', label: 'Memory', icon: Brain },
          { id: 'privacy', label: 'Privacy', icon: Eye },
          { id: 'theme', label: 'Theme', icon: Palette },
          { id: 'voice', label: 'Voice', icon: Mic },
        ].map(({ id, label, icon: NavIcon }) => (
          <button
            key={id}
            value={id}
            onClick={() => {
              setActiveTab(id);
              // Scroll to the tabs area smoothly
              document.getElementById('settings-tabs-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`flex items-center gap-1.5 min-h-[44px] whitespace-nowrap ${
              activeTab === id ? 'gs-pill-active' : 'gs-pill'
            }`}
          >
            <NavIcon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </nav>

      <div id="settings-tabs-anchor" className="space-y-6">

        {/* Profile Tab */}
        {activeTab === 'profile' && <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="gs-card p-6 text-center">
                <div className="relative inline-block mb-4">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-24 h-24 mx-auto rounded-full bg-[var(--ag-bg-surface)] object-cover" />
                  ) : (
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#FF2D78] flex items-center justify-center text-3xl font-bold">
                      {(profile.name || user?.email?.split('@')[0] || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const seed = encodeURIComponent((profile.username || profile.name || 'user') + '-' + Date.now());
                      const url = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=7B61FF,0f0b1e`;
                      setProfile({ ...profile, avatar: url });
                    }}
                    className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[#8B5CF6] flex items-center justify-center hover:bg-[#A78BFA] transition-colors press-scale"
                    title="Generate new pixel avatar"
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                  </button>
                </div>
                {/* 53.9: Upload photo with live preview */}
                <div className="mt-2">
                  <label className="cursor-pointer">
                    <span className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] transition-colors underline underline-offset-2">Upload Photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 500 * 1024) {
                          setAvatarError('Image must be under 500 KB');
                          return;
                        }
                        setAvatarError(null);
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const dataUrl = ev.target?.result as string;
                          if (dataUrl) {
                            setProfile({ ...profile, avatar: dataUrl });
                            setHasUnsavedChanges(true);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {avatarError && <p className="text-xs text-[#FF3366] mt-1">{avatarError}</p>}
                  {!avatarError && <p className="text-xs text-[var(--ag-text-muted)] mt-1">Max 500 KB · JPEG, PNG, WebP</p>}
                </div>
                <h3 className="font-semibold text-[#F4F6FF]">{profile.name || user?.name || user?.email?.split('@')[0] || 'User'}</h3>
                <p className="text-sm text-[var(--ag-text-muted)]">@{profile.username}</p>
                {/* 77.6: Dynamic plan badge */}
                {(() => {
                  const plan = user?.plan as string | undefined;
                  if (!plan || plan === 'free') {
                    return (
                      <Badge variant="outline" className="mt-3 border-[#6B7280]/30 text-[var(--ag-text-muted)]">
                        Free Plan
                      </Badge>
                    );
                  }
                  const isPremium = plan === 'yearly' || plan === 'halfyear' || plan === 'monthly';
                  const label = plan === 'yearly' ? 'Premium — Yearly'
                    : plan === 'halfyear' ? 'Premium — 6 Month'
                    : plan === 'monthly' ? 'Premium — Monthly'
                    : plan === 'intro' ? 'Intro Plan'
                    : plan === 'team' ? 'Team Plan'
                    : `${plan.charAt(0).toUpperCase()}${plan.slice(1)} Plan`;
                  return (
                    <Badge
                      variant="outline"
                      className="mt-3"
                      style={{
                        borderColor: isPremium ? 'rgba(139,92,246,0.4)' : 'rgba(0,255,136,0.3)',
                        color: isPremium ? '#8B5CF6' : '#00FF88',
                      }}
                    >
                      {label}
                    </Badge>
                  );
                })()}
            </div>

            <div className="gs-card lg:col-span-2">
              <p className="gs-section-label mb-1">Account</p>
              <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Profile Information</h3>
              <p className="text-sm text-[#9CA3AF] mb-4">Update your public profile</p>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Display Name</label>
                    <Input value={profile.name} placeholder="Your name" onChange={(e) => { setProfile({ ...profile, name: e.target.value }); setHasUnsavedChanges(true); }} className="gs-input" />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Username</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ag-text-muted)]">@</span>
                      <Input value={profile.username} onChange={(e) => { setProfile({ ...profile, username: e.target.value }); setHasUnsavedChanges(true); }} className="gs-input pl-8" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Email</label>
                  <Input type="email" value={profile.email} placeholder="your@email.com" onChange={(e) => { setProfile({ ...profile, email: e.target.value }); setHasUnsavedChanges(true); }} className="gs-input" />
                </div>
                <div>
                  <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Bio</label>
                  <textarea value={profile.bio} onChange={(e) => { setProfile({ ...profile, bio: e.target.value }); setHasUnsavedChanges(true); }} className="gs-input min-h-[100px] resize-none w-full p-3" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Location</label>
                    <Input value={profile.location} onChange={(e) => { setProfile({ ...profile, location: e.target.value }); setHasUnsavedChanges(true); }} className="gs-input" />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Website</label>
                    <Input value={profile.website} onChange={(e) => { setProfile({ ...profile, website: e.target.value }); setHasUnsavedChanges(true); }} className="gs-input" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && <div className="space-y-6">
          <div className="gs-card">
            <p className="gs-section-label mb-1">Alerts</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Notification Preferences</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Choose how you want to be notified</p>
            <div className="space-y-6">
              {[
                { key: 'emailReminders', icon: Mail, title: 'Email Reminders', desc: 'Get reminders via email' },
                { key: 'pushNotifications', icon: Smartphone, title: 'Push Notifications', desc: 'Browser push notifications' },
                { key: 'reminderNotifs', icon: Bell, title: 'Reminder Notifications', desc: 'Alerts when reminders are due' },
                { key: 'weeklyDigest', icon: Globe, title: 'Weekly Digest', desc: 'Weekly summary of activity' },
                { key: 'securityAlerts', icon: Shield, title: 'Security Alerts', desc: 'Important security notifications' },
                { key: 'connectionAlerts', icon: Users, title: 'Connection Request Alerts', desc: 'Notifications for new connection requests' },
                { key: 'weeklyDigestToggle', icon: CalendarDays, title: 'Weekly Digest Email', desc: 'Weekly activity digest delivered to your inbox' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-[#8B5CF6]" />
                    </div>
                    <div>
                      <div className="font-medium text-[var(--ag-text-primary)]">{item.title}</div>
                      <div className="text-sm text-[var(--ag-text-muted)]">{item.desc}</div>
                    </div>
                  </div>
                  <Switch
                    checked={notifications[item.key as keyof typeof notifications]}
                    onCheckedChange={(checked) => {
                      setNotifications({ ...notifications, [item.key]: checked });
                      void saveNotification(item.key, checked);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Telegram Notification Preferences Card */}
          <div className="gs-card">
            <p className="gs-section-label mb-1">Telegram</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Telegram Alerts</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Choose which alerts are sent to your Telegram</p>
            <div className="space-y-4">
              {([
                { key: 'notif_reminders' as const, title: 'Reminder alerts', desc: 'Get notified when a reminder fires' },
                { key: 'notif_escalations' as const, title: 'Escalation alerts', desc: 'Receive replies to Telegram escalations' },
                { key: 'notif_agents' as const, title: 'Agent activity alerts', desc: 'Notifications for agent actions and tasks' },
                { key: 'notif_daily_briefing' as const, title: 'Daily briefing', desc: 'Deliver your daily AI briefing via Telegram' },
                { key: 'notif_connections' as const, title: 'Connection alerts', desc: 'Get notified when someone accepts your invite' },
              ] as const).map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[var(--ag-text-primary)] text-sm">{item.title}</div>
                    <div className="text-xs text-[var(--ag-text-muted)] mt-0.5">{item.desc}</div>
                  </div>
                  <Switch
                    checked={agentNotifs[item.key] === 1}
                    onCheckedChange={(checked) => {
                      const updated = { ...agentNotifs, [item.key]: checked ? 1 : 0 };
                      setAgentNotifs(updated);
                      void agentService.updateConfig({ [item.key]: checked ? 1 : 0 }).then(() => showSavedToast()).catch(() => {});
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 41.6: Snooze Presets Card */}
          <div className="gs-card">
            <p className="gs-section-label mb-1">Reminders</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Snooze Presets</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Choose which snooze options appear when delaying a reminder</p>
            <div className="space-y-3">
              {(['1h', '3h', 'tomorrow', 'next-week'] as const).map((preset) => {
                const labels: Record<string, string> = { '1h': '1 hour', '3h': '3 hours', 'tomorrow': 'Tomorrow 9am', 'next-week': 'Next week 9am' };
                const enabled = snoozePresets.includes(preset);
                return (
                  <div key={preset} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-[var(--ag-text-primary)] text-sm">{labels[preset]}</div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => {
                        const updated = checked
                          ? [...snoozePresets, preset]
                          : snoozePresets.filter((p) => p !== preset);
                        setSnoozePresets(updated);
                        void agentService.updateConfig({ snooze_presets: JSON.stringify(updated) }).then(() => showSavedToast()).catch(() => {});
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 59.10: Reset Agent Config to Defaults */}
          <div className="gs-card !border-[#FF6161]/20">
            <p className="gs-section-label mb-1">Danger</p>
            <h3 className="text-base font-semibold text-[var(--ag-text-primary)] mb-1">Reset Agent Configuration</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Restore all agent notification and snooze settings to their defaults</p>
            <Button
              variant="ghost"
              onClick={() => void handleResetAgentConfig()}
              disabled={isResettingAgent}
              data-testid="reset-agent-config-btn"
              className="gs-btn-ghost flex items-center gap-2 text-[#FF6161] hover:text-[#FF6161] hover:bg-[#FF6161]/10 border border-[#FF6161]/30"
            >
              {isResettingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Reset to Defaults
            </Button>
          </div>
        </div>}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && <div className="space-y-6">
          {/* Active Sessions Card */}
          <div className="gs-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="gs-section-label mb-1">Security</p>
                <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Active Sessions</h3>
                <p className="text-sm text-[#9CA3AF]">Devices where you are currently signed in</p>
              </div>
                {sessions.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#FF6161]/40 text-[#FF6161] hover:bg-[#FF6161]/10"
                    onClick={async () => {
                      await userService.revokeAllSessions().catch(() => {});
                      setSessions([]);
                    }}
                  >
                    <LogOut className="w-3 h-3 mr-1" />
                    Revoke all
                  </Button>
                )}
              </div>
            <div className="space-y-3">
              {sessionsLoading ? (
                <div className="flex items-center gap-2 py-4 text-[var(--ag-text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading sessions...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-6">
                  <Monitor className="w-8 h-8 text-[#8B5CF6]/30 mx-auto mb-2" />
                  <p className="text-sm text-[var(--ag-text-muted)]">No active sessions found</p>
                </div>
              ) : (
                sessions.map((s) => {
                  // Identify the current session as the one with the most recent last_seen
                  const isCurrent = sessions.length > 0 &&
                    s.id === [...sessions].sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())[0].id;
                  return (
                    <div key={s.id} className={`flex items-center justify-between p-3 rounded-xl  border transition-all ${
                      isCurrent ? 'border-[#8B5CF6]/50 ring-1 ring-[#8B5CF6]/20' : 'border-[#8B5CF6]/20'
                    }`}>
                      <div className="flex items-center gap-3">
                        <Monitor className={`w-5 h-5 flex-shrink-0 ${isCurrent ? 'text-[#8B5CF6]' : 'text-[var(--ag-text-muted)]'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--ag-text-primary)] truncate max-w-[200px]">
                              {s.user_agent.slice(0, 40) || 'Unknown browser'}
                            </span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] text-[10px] font-semibold uppercase tracking-wider flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--ag-text-muted)]">
                            {s.ip || 'Unknown IP'} · Last seen {new Date(s.last_seen).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      {!isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#FF6161] hover:text-[#FF6161] hover:bg-[#FF6161]/10 flex-shrink-0"
                          onClick={() => handleRevokeSession(s.id)}
                        >
                          <LogOut className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
              <p className="text-xs text-[var(--ag-text-muted)] pt-1">
                Note: Revoking a session marks it inactive in the database but existing tokens remain valid until they expire.
              </p>
            </div>
          </div>

          {/* Detected Timezone Card */}
          <div className="gs-card">
            <p className="gs-section-label mb-1">Locale</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-[#8B5CF6]" />Timezone
            </h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Auto-detected from your browser</p>
            <div className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-[#8B5CF6]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--ag-text-primary)]">{detectedTimezone}</p>
                    <p className="text-xs text-[var(--ag-text-muted)]">
                      Current time: {new Date().toLocaleTimeString('en-US', { timeZone: detectedTimezone, hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-[#00FF88]/30 text-[#00FF88] text-xs">
                  Auto-detected
                </Badge>
              </div>
              <p className="text-xs text-[var(--ag-text-muted)] mt-2">
                This timezone is used for reminders, daily briefings, and scheduling. It updates automatically based on your device settings.
              </p>
          </div>

          {/* GDPR Data Export Card */}
          <div className="gs-card">
            <p className="gs-section-label mb-1">Privacy</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] flex items-center gap-2 mb-1">
              <FileDown className="w-4 h-4 text-[#8B5CF6]" />Data Export (GDPR)
            </h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Download a copy of all your data stored in Agentin</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[#8B5CF6]/5 border border-white/[0.06]">
                <Shield className="w-4 h-4 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--ag-text-muted)]">
                  Your export includes your profile, conversation history, memories, active sessions, and preferences.
                  The file is downloaded directly to your device and is not stored on our servers.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => void handleGDPRExport()}
                disabled={isExportingGDPR}
                className="gs-btn-ghost border-[#8B5CF6]/30 text-[#8B5CF6]"
                data-testid="gdpr-export-btn"
              >
                {isExportingGDPR ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" />Download All My Data</>
                )}
              </Button>
            </div>
          </div>
        </div>}

        {/* Security Tab */}
        {activeTab === 'security' && <div className="space-y-6">
          {/* Preferred AI Engine Card */}
          <div className="gs-card">
            <p className="gs-section-label mb-1">AI</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Preferred AI Engine</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Choose which AI model powers your assistant</p>
            <div className="space-y-3">
              {[
                { value: 'auto', label: 'Auto (Recommended)', desc: 'Agentin picks the best engine for each task' },
                { value: 'local', label: 'Local Engine (Ollama)', desc: 'Fastest, no cloud — runs on-device' },
                { value: 'cloud', label: 'Cloud Engine (OpenRouter)', desc: 'More capable, uses your credits' },
                { value: 'premium', label: 'Premium (Edith / Kimi K2)', desc: 'Most powerful — highest credit cost' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSaveModel(opt.value)}
                  disabled={modelSaving}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    preferredModel === opt.value
                      ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6]'
                      : ' border-[#8B5CF6]/20 text-[var(--ag-text-primary)] hover:border-[#8B5CF6]/50'
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-[var(--ag-text-muted)] mt-0.5">{opt.desc}</div>
                </button>
              ))}
              {modelSaving && (
                <div className="flex items-center gap-2 text-[var(--ag-text-muted)] text-sm">
                  <Loader2 className="w-3 h-3 animate-spin" />Saving...
                </div>
              )}
            </div>
          </div>

          {/* 39.4: Preferred Free Model Card */}
          <div className="gs-card">
            <p className="gs-section-label mb-1">AI</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Preferred Free Model</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Pick which OpenRouter free model to use when cloud mode is selected</p>
            <div className="space-y-3">
              <select
                value={preferredFreeModel}
                onChange={async (e) => {
                  const val = e.target.value;
                  setPreferredFreeModel(val);
                  setFreeModelSaving(true);
                  try {
                    await agentService.updateConfig({ preferred_free_model: val });
                    showSavedToast();
                  } catch { /* ignore */ } finally {
                    setFreeModelSaving(false);
                  }
                }}
                className="gs-input w-full"
              >
                <option value="auto">Auto (Agentin selects best available)</option>
                {freeModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
              </select>
              {freeModelSaving && (
                <div className="flex items-center gap-2 text-[var(--ag-text-muted)] text-sm">
                  <Loader2 className="w-3 h-3 animate-spin" />Saving...
                </div>
              )}
              <p className="text-xs text-[var(--ag-text-muted)]">
                Only applies when your engine is set to Cloud or Auto. Free models have usage limits.
              </p>
            </div>
          </div>

          {/* 52.4: Change Password Card */}
          <div className="gs-card">
            <p className="gs-section-label mb-1">Security</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Change Password</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Update your account password</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Current Password</label>
                <Input
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => { setPwCurrent(e.target.value); setPwError(''); setPwSuccess(''); }}
                  placeholder="Enter current password"
                  className="gs-input"
                />
              </div>
              <div>
                <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">New Password</label>
                <Input
                  type="password"
                  value={pwNew}
                  onChange={(e) => { setPwNew(e.target.value); setPwError(''); setPwSuccess(''); }}
                  placeholder="Enter new password"
                  className="gs-input"
                />
                {/* Password strength meter */}
                {pwNew.length > 0 && (() => {
                  let score = 0;
                  if (pwNew.length >= 8) score++;
                  if (/[0-9]/.test(pwNew)) score++;
                  if (/[a-z]/.test(pwNew)) score++;
                  if (/[A-Z]/.test(pwNew)) score++;
                  if (/[^A-Za-z0-9]/.test(pwNew)) score++;
                  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
                  const segmentColors = [
                    'bg-[#EF4444]',
                    'bg-[#F97316]',
                    'bg-[#EAB308]',
                    'bg-[#22C55E]',
                    'bg-[#8B5CF6]',
                  ];
                  return (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                              i < score ? segmentColors[score - 1] : 'bg-[#1C1C2E]'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs ${segmentColors[score - 1].replace('bg-', 'text-')}`}>
                        {labels[score - 1] ?? ''}
                      </p>
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Confirm New Password</label>
                <Input
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => { setPwConfirm(e.target.value); setPwError(''); setPwSuccess(''); }}
                  placeholder="Confirm new password"
                  className="gs-input"
                />
              </div>
              {pwError && (
                <p className="text-sm text-[#EF4444]">{pwError}</p>
              )}
              {pwSuccess && (
                <p className="text-sm text-[#00FF88]">{pwSuccess}</p>
              )}
              <Button
                disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
                onClick={async () => {
                  setPwError('');
                  setPwSuccess('');
                  if (pwNew !== pwConfirm) {
                    setPwError('New passwords do not match.');
                    return;
                  }
                  if (pwNew.length < 8) {
                    setPwError('New password must be at least 8 characters.');
                    return;
                  }
                  setPwSaving(true);
                  try {
                    await userService.changePassword(pwCurrent, pwNew);
                    setPwSuccess('Password updated successfully.');
                    setPwCurrent('');
                    setPwNew('');
                    setPwConfirm('');
                  } catch (err: unknown) {
                    const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
                    setPwError(
                      axiosErr?.response?.data?.error ||
                      axiosErr?.response?.data?.message ||
                      'Failed to update password. Please try again.'
                    );
                  } finally {
                    setPwSaving(false);
                  }
                }}
                className="gs-btn-primary min-h-[44px] press-scale"
              >
                {pwSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Key className="w-4 h-4 mr-2" />Update Password</>
                )}
              </Button>
            </div>
          </div>

          {/* 82.8: Danger Zone — Delete Account */}
          <div className="gs-card !border-[#FF2D78]/30">
            <p className="gs-section-label mb-1 !text-[#FF2D78]/70">Danger</p>
            <h3 className="text-base font-semibold text-[#FF2D78] flex items-center gap-2 mb-1">
              <Trash2 className="w-4 h-4" /> Danger Zone
            </h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Actions here are irreversible. Proceed with caution.</p>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[#FF2D78]/5 border border-[#FF2D78]/20">
                <Shield className="w-4 h-4 text-[#FF2D78] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--ag-text-muted)]">
                  Deleting your account will permanently erase all conversations, reminders, automations,
                  memories, documents, and settings. This action cannot be reversed.
                </p>
              </div>
              {!showDeleteConfirm ? (
                <Button
                  variant="outline"
                  className="border-[#FF2D78]/40 text-[#FF2D78] hover:bg-[#FF2D78]/10 hover:border-[#FF2D78]/60"
                  onClick={() => { setShowDeleteConfirm(true); setDeleteError(''); setDeletePassword(''); setDeleteConfirmText(''); }}
                  data-testid="delete-account-open-btn"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete My Account
                </Button>
              ) : (
                <div className="space-y-3 p-4 rounded-xl bg-[#FF2D78]/[0.03] border border-[#FF2D78]/20">
                  <p className="text-sm text-[var(--ag-text-primary)] font-medium">
                    To confirm, type <span className="text-[#FF2D78] font-bold font-mono">DELETE</span> below, then enter your password.
                  </p>
                  <div>
                    <label className="text-xs text-[var(--ag-text-muted)] mb-1.5 block">Type DELETE to confirm</label>
                    <Input
                      type="text"
                      placeholder="DELETE"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className={`gs-input font-mono tracking-wider ${
                        deleteConfirmText === 'DELETE'
                          ? '!border-[#FF2D78]/60'
                          : '!border-[#FF2D78]/20'
                      }`}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--ag-text-muted)] mb-1.5 block">Your current password</label>
                    <Input
                      type="password"
                      placeholder="Enter password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="gs-input !border-[#FF2D78]/20"
                      data-testid="delete-account-password-input"
                    />
                  </div>
                  {deleteError && (
                    <p className="text-xs text-[#FF2D78]">{deleteError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteConfirmText(''); setDeleteError(''); }}
                      className="border-[#8B5CF6]/20 text-[var(--ag-text-muted)]"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={isDeleting || deletePassword.length < 6 || deleteConfirmText !== 'DELETE'}
                      onClick={async () => {
                        setDeleteError('');
                        setIsDeleting(true);
                        try {
                          await authService.deleteUserAccount(deletePassword);
                          logout();
                        } catch (err: unknown) {
                          const axiosErr = err as { response?: { data?: { error?: string } } };
                          setDeleteError(axiosErr?.response?.data?.error || 'Failed to delete account. Check your password and try again.');
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      className="bg-[#FF2D78] hover:bg-[#E0266A] text-white disabled:opacity-40"
                      data-testid="delete-account-confirm-btn"
                    >
                      {isDeleting ? (
                        <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Deleting…</>
                      ) : (
                        'Permanently Delete Account'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>}

        {/* API Keys Tab */}
        {activeTab === 'apikeys' && <div className="space-y-6">
          <div className="gs-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="gs-section-label mb-1">Developer</p>
                <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">API Keys</h3>
                <p className="text-sm text-[#9CA3AF]">Manage provider keys for &quot;Bring Your Own&quot; mode</p>
              </div>
              <Button onClick={() => setShowAddKey(true)} className="gs-btn-primary min-h-[44px]">
                <Plus className="w-4 h-4 mr-2" />Add Key
              </Button>
            </div>
            <div className="space-y-4">
              {apiKeys.length === 0 && !showAddKey && (
                <div className="text-center py-8">
                  <Key className="w-10 h-10 text-[#8B5CF6]/30 mx-auto mb-3" />
                  <p className="text-[var(--ag-text-muted)] mb-2">No API keys added yet</p>
                  <p className="text-sm text-[var(--ag-text-muted)]">Add your provider keys to use your own credits</p>
                </div>
              )}

              {apiKeys.map((key) => (
                <div key={key.id} className="rounded-xl border border-[#8B5CF6]/20 overflow-hidden">
                  <div className="flex items-center justify-between p-4 gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: `${providerColors[key.provider]}20` }}>
                        {providerEmoji[key.provider] ?? '🔑'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--ag-text-primary)] truncate">{key.label}</div>
                        <div className="text-sm text-[var(--ag-text-muted)] font-mono truncate">
                          {key.maskedKey.length > 12
                            ? `${key.maskedKey.slice(0, 4)}...${key.maskedKey.slice(-4)}`
                            : key.maskedKey}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="sm"
                        onClick={() => { setRotatingKeyId(rotatingKeyId === key.id ? null : key.id); setRotateValue(''); }}
                        className="text-[#8B5CF6]/70 hover:text-[#8B5CF6] text-xs px-2">
                        Rotate
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setApiKeys(apiKeys.filter(k => k.id !== key.id))} className="text-[#FF6161] hover:text-[#FF6161]">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {rotatingKeyId === key.id && (
                    <div className="px-4 pb-4 flex gap-2 border-t border-[#8B5CF6]/10 pt-3">
                      <Input
                        type="password"
                        placeholder="Paste new key value…"
                        value={rotateValue}
                        onChange={(e) => setRotateValue(e.target.value)}
                        className="gs-input flex-1 text-sm"
                      />
                      <Button size="sm" disabled={isRotating || rotateValue.trim().length < 8}
                        onClick={() => handleRotateKey(key.id)}
                        className="bg-[#8B5CF6]/10 text-[#8B5CF6] hover:bg-[#8B5CF6]/20 border border-[#8B5CF6]/30">
                        {isRotating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {showAddKey && (
                <div className="p-4 rounded-xl border border-[#8B5CF6]/30 space-y-3">
                  <div>
                    <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Provider</label>
                    <div className="flex gap-2 flex-wrap">
                      {(['openai', 'anthropic', 'qwen', 'openrouter'] as ApiProvider[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => setNewKeyProvider(p)}
                          className={`px-3 py-2 min-h-[44px] rounded-lg text-sm capitalize transition-all ${
                            newKeyProvider === p
                              ? 'bg-[#8B5CF6]/20 border border-[#8B5CF6] text-[#8B5CF6]'
                              : 'bg-[var(--ag-bg-surface)] border border-[#8B5CF6]/20 text-[var(--ag-text-muted)]'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">API Key</label>
                    <Input
                      type="password"
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      placeholder="sk-..."
                      className="gs-input font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setShowAddKey(false); setNewKeyValue(''); }} className="gs-btn-ghost">
                      Cancel
                    </Button>
                    <Button onClick={handleAddKey} disabled={!newKeyValue} className="gs-btn-primary min-h-[44px] press-scale">
                      Save Key
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>}

        {/* Memory Tab */}
        {activeTab === 'memory' && <div className="space-y-6">
          <div className="gs-card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="gs-section-label mb-1">AI</p>
                <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Agent Memory</h3>
                <p className="text-sm text-[#9CA3AF]">What your AI assistant remembers about you</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'fact', 'preference'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setMemoryFilter(cat)}
                    className={`min-h-[44px] text-xs capitalize ${memoryFilter === cat ? 'gs-pill-active' : 'gs-pill'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {memoriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : memories.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="w-10 h-10 text-[#8B5CF6]/30 mx-auto mb-3" />
                  <p className="text-[var(--ag-text-muted)] mb-2">No memories yet</p>
                  <p className="text-sm text-[var(--ag-text-muted)]">Your agent learns about you through conversations</p>
                </div>
              ) : (
                memories.map((memory) => (
                  <div key={memory.id} className="flex items-start justify-between p-4 rounded-xl border border-[#8B5CF6]/20 group hover:border-[#8B5CF6]/40 transition-all">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{
                        backgroundColor: memory.category === 'fact' ? '#00FF8815' : '#8B5CF615'
                      }}>
                        <Tag className="w-4 h-4" style={{
                          color: memory.category === 'fact' ? '#00FF88' : '#8B5CF6'
                        }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[var(--ag-text-primary)]">{memory.key}</span>
                          <Badge variant="outline" className="text-xs border-[#8B5CF6]/30 text-[var(--ag-text-muted)]">{memory.category}</Badge>
                        </div>
                        <p className="text-sm text-[var(--ag-text-muted)]">{memory.value}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-[var(--ag-text-muted)]/60">
                          <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(memory.updatedAt || memory.createdAt).toLocaleDateString()}</span>
                          <span>Confidence: {Math.round(memory.confidence * 100)}%</span>
                          <span>Source: {memory.source}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMemory(memory.id)}
                      className="text-[#FF6161] hover:text-[#FF6161] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {reactionSummary.length > 0 && (
            <div className="gs-card">
              <h3 className="text-sm font-semibold text-[#F4F6FF] flex items-center gap-2 mb-1">
                <span className="text-base">✨</span> Top Reactions
              </h3>
              <p className="text-xs text-[#9CA3AF] mb-3">Your most-used reactions on agent messages</p>
              <div className="flex flex-wrap gap-2">
                {reactionSummary.map(({ reaction, count }) => (
                  <div
                    key={reaction}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                  >
                    <span className="text-base leading-none">{reaction}</span>
                    <span className="text-xs font-bold text-[#8B5CF6]">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 60.2: Starred Messages */}
          <div className="gs-card !border-[#F59E0B]/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#F4F6FF] flex items-center gap-2">
                <span className="text-base">⭐</span> Starred Messages
                {starredMessages.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">{starredMessages.length}</span>
                )}
              </h3>
              <button
                onClick={() => setShowStarred(s => !s)}
                className="text-xs text-[var(--ag-text-muted)] hover:text-[#F59E0B] transition-colors"
              >
                {showStarred ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-[#9CA3AF] mb-3">Messages you've starred from your conversation history</p>
            {showStarred && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {starredMessages.length === 0 ? (
                  <p className="text-xs text-[#4B5563] py-2">No starred messages yet. Star messages from your conversation history.</p>
                ) : (
                  starredMessages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.04] border border-[#F59E0B]/20">
                      <span className="text-xs mt-0.5">{msg.role === 'user' ? '👤' : '🤖'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--ag-text-primary)] line-clamp-2">{msg.content}</p>
                        <p className="text-xs text-[#4B5563] mt-0.5">{new Date(msg.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => {
                          agentService.toggleStar(msg.id).then(() => {
                            setStarredMessages(prev => prev.filter(m => m.id !== msg.id));
                          }).catch(() => {});
                        }}
                        className="shrink-0 text-[#F59E0B] hover:text-[var(--ag-text-muted)] transition-colors"
                        title="Unstar"
                        data-testid={`unstar-msg-${msg.id}`}
                      >
                        ★
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="gs-card">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">How Memory Works</h4>
                <p className="text-xs text-[var(--ag-text-muted)]">
                  Your agent learns about you through conversations — extracting facts, preferences, and context.
                  Memories improve response quality over time. You can delete any memory at any time.
                </p>
              </div>
            </div>
          </div>

          <div className="gs-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">Chat History Export</h4>
                  <p className="text-xs text-[var(--ag-text-muted)]">Download your full conversation history as a JSON file.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportConversations}
                  disabled={isExportingConversations}
                  className="gs-btn-ghost text-[#8B5CF6]"
                >
                  {isExportingConversations ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Export as JSON
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">Export as Markdown</h4>
                  <p className="text-xs text-[var(--ag-text-muted)]">Download chat history as a readable Markdown (.md) file.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportMarkdown7Days}
                    disabled={isExportingMarkdown7Days}
                    className="gs-btn-ghost text-[#BF5FFF]"
                  >
                    {isExportingMarkdown7Days ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CalendarDays className="w-4 h-4 mr-2" />
                    )}
                    Last 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportMarkdown}
                    disabled={isExportingMarkdown}
                    className="gs-btn-ghost text-[#BF5FFF]"
                  >
                    {isExportingMarkdown ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    All time
                  </Button>
                </div>
              </div>
            </div>
          </div>
        }

        {/* Privacy Tab */}
        {activeTab === 'privacy' && <div className="space-y-6">
          <div className="gs-card">
            <p className="gs-section-label mb-1">Visibility</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Privacy Controls</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Control what is visible on your public portfolio</p>
            <div className="space-y-6">
              {[
                { key: 'showProfile' as const, icon: Eye, title: 'Show in Public Directory', desc: 'Allow others to discover you via Explore' },
                { key: 'showActivity' as const, icon: Clock, title: 'Show Recent Activity', desc: 'Show milestones and activity on portfolio' },
                { key: 'allowAgentChat' as const, icon: Brain, title: 'Allow Agent Chat', desc: 'Let your agent chat with other agents on your behalf' },
                { key: 'showLocation' as const, icon: MapPin, title: 'Show Location', desc: 'Display city/timezone on profile' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-[#8B5CF6]" />
                    </div>
                    <div>
                      <div className="font-medium text-[#F4F6FF]">{item.title}</div>
                      <div className="text-sm text-[#9CA3AF]">{item.desc}</div>
                    </div>
                  </div>
                  <Switch
                    checked={privacy[item.key]}
                    onCheckedChange={async (checked) => {
                      const prev = { ...privacy };
                      const newPrivacy = { ...privacy, [item.key]: checked };
                      setPrivacy(newPrivacy);
                      try {
                        await userService.updateProfile({ privacy: { [item.key]: checked } } as Parameters<typeof userService.updateProfile>[0]);
                        showSavedToast();
                      } catch {
                        // revert on failure
                        setPrivacy(prev);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="gs-card">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">What We Never Show</h4>
                <p className="text-xs text-[var(--ag-text-muted)]">
                  Raw chat logs, internal system data, precise location (only city if enabled), and API keys are never exposed publicly.
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => void handlePrivacySave()}
              disabled={savingPrivacy}
              className="gs-btn-primary min-h-[44px] press-scale"
            >
              {savingPrivacy ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Save Privacy Settings</>
              )}
            </Button>
          </div>
        </div>}

        {/* Theme Tab */}
        {activeTab === 'theme' && <div className="space-y-6">
          <div className="gs-card">
            <p className="gs-section-label mb-1">Display</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] mb-1">Appearance</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Customize the look of your dashboard</p>
            <div className="space-y-6">
              {/* 56.7: Prominent 3-way theme toggle with icons */}
              <div>
                <label className="text-sm text-[var(--ag-text-muted)] mb-3 block">Theme Mode</label>
                <div className="inline-flex rounded-xl border border-[#8B5CF6]/20 p-1 gap-1">
                  {([
                    { id: 'dark', label: 'Dark', Icon: Moon },
                    { id: 'light', label: 'Light', Icon: Sun },
                    { id: 'system', label: 'System', Icon: Monitor },
                  ] as const).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => {
                        setThemeMode(id);
                        void userService.updateProfile({ theme: { mode: id } } as Parameters<typeof userService.updateProfile>[0]);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        themeMode === id
                          ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] shadow-inner'
                          : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--ag-text-muted)]">
                  {themeMode === 'system' ? 'Follows your OS preference' : themeMode === 'dark' ? 'Dark mode active' : 'Light mode active'}
                </p>
                {/* Live mini theme preview card */}
                <div
                  className="mt-3 rounded-xl border overflow-hidden transition-all duration-500"
                  style={{
                    borderColor: themeMode === 'light' ? '#e5e7eb' : 'rgba(139,92,246,0.15)',
                    background: themeMode === 'light' ? '#ffffff' : '#0C0C18',
                  }}
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full transition-colors duration-500"
                        style={{ background: themeMode === 'light' ? '#e5e7eb' : '#1A1A2E' }}
                      />
                      <div className="flex-1 space-y-1">
                        <div
                          className="h-2 rounded-full w-3/4 transition-colors duration-500"
                          style={{ background: themeMode === 'light' ? '#d1d5db' : '#1A1A2E' }}
                        />
                        <div
                          className="h-2 rounded-full w-1/2 transition-colors duration-500"
                          style={{ background: themeMode === 'light' ? '#e5e7eb' : '#12121F' }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="h-5 flex-1 rounded transition-colors duration-500" style={{ background: accentColor + '25' }} />
                      <div
                        className="h-5 px-3 rounded text-[9px] font-medium flex items-center transition-colors duration-500"
                        style={{ background: accentColor, color: themeMode === 'light' ? '#fff' : '#0C0C18' }}
                      >
                        Button
                      </div>
                    </div>
                    <div
                      className="text-[9px] text-center transition-colors duration-500"
                      style={{ color: themeMode === 'light' ? '#6b7280' : '#9CA3AF' }}
                    >
                      Preview — {themeMode === 'light' ? 'Light' : themeMode === 'dark' ? 'Dark' : 'System'} Mode
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-[var(--ag-text-muted)] mb-3 block">Accent Color</label>
                <div className="flex gap-3 flex-wrap">
                  {accentPresets.map((color) => (
                    <button
                      key={color}
                      onClick={() => { setAccentColor(color); void agentService.updateConfig({ accentColor: color }).then(() => showSavedToast()).catch(() => {}); }}
                      className={`w-10 h-10 sm:w-8 sm:h-8 rounded-xl transition-all ${
                        accentColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C0C18] scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm text-[var(--ag-text-muted)]">Custom:</label>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => { setAccentColor(e.target.value); void agentService.updateConfig({ accentColor: e.target.value }).then(() => showSavedToast()).catch(() => {}); }}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent"
                  />
                  <span className="text-sm font-mono text-[var(--ag-text-muted)]">{accentColor}</span>
                </div>
              </div>

              {/* Compact Mode */}
              <div className="flex items-center justify-between py-3 border-t border-[#8B5CF6]/10">
                <div>
                  <p className="text-sm font-medium text-[var(--ag-text-primary)]">Compact Mode</p>
                  <p className="text-xs text-[var(--ag-text-muted)] mt-0.5">Reduce card padding and spacing for a denser layout</p>
                </div>
                <Switch
                  checked={compactMode}
                  onCheckedChange={setCompactMode}
                  aria-label="Compact Mode"
                />
              </div>

              {/* AI Background Generator */}
              <div className="space-y-3">
                <label className="text-sm text-[var(--ag-text-muted)] block">AI-Generated Background</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Describe a vibe (optional)..."
                    value={bgVibe}
                    onChange={(e) => setBgVibe(e.target.value)}
                    className="gs-input flex-1"
                  />
                  <Button onClick={handleGenerateBg} disabled={isGeneratingBg} size="sm" className="gs-btn-primary min-h-[44px]">
                    {isGeneratingBg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </Button>
                </div>
                {bgPreview && (
                  <div className="space-y-2">
                    <div
                      className="h-24 rounded-xl border border-[#8B5CF6]/20"
                      style={{ background: bgPreview.gradient }}
                    />
                    <p className="text-xs text-[var(--ag-text-muted)]">"{bgPreview.name}" — click Apply to use this background</p>
                    <div className="flex gap-2">
                      <Button onClick={handleApplyBg} size="sm" className="gs-btn-primary min-h-[44px] press-scale">Apply</Button>
                      <Button onClick={handleGenerateBg} variant="outline" size="sm" className="gs-btn-ghost">Try another</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>}

        {activeTab === 'voice' && <div className="space-y-6">
          <div className="gs-card">
            {/* tab: value="voice" */}
            <p className="gs-section-label mb-1">Audio</p>
            <h3 className="text-base font-semibold text-[#F4F6FF] flex items-center gap-2 mb-1">
              <Volume2 className="w-5 h-5 text-[#8B5CF6]" />Voice Settings
            </h3>
            <p className="text-sm text-[#9CA3AF] mb-4">Configure text-to-speech and voice input.</p>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-[var(--ag-text-primary)]">Enable TTS (Text-to-Speech)</h4>
                  <p className="text-xs text-[var(--ag-text-muted)] mt-0.5">Read agent responses aloud in Voice Chat.</p>
                </div>
                <Switch checked={voiceSettings.enabled} onCheckedChange={(v) => saveVoiceSettings({ enabled: v })} aria-label="Enable TTS" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--ag-text-primary)]">Speech Rate</label>
                  <span className="text-xs text-[var(--ag-text-muted)]">{voiceSettings.rate.toFixed(1)}x</span>
                </div>
                <input type="range" min="0.5" max="2" step="0.1" value={voiceSettings.rate} onChange={(e) => saveVoiceSettings({ rate: parseFloat(e.target.value) })} className="w-full accent-[#8B5CF6]" />
                <div className="flex justify-between text-xs text-[var(--ag-text-muted)]"><span>0.5x slow</span><span>1x normal</span><span>2x fast</span></div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--ag-text-primary)]">Language</label>
                <select value={voiceSettings.lang} onChange={(e) => saveVoiceSettings({ lang: e.target.value })} className="gs-input w-full">
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="hi-IN">Hindi (India)</option>
                  <option value="es-ES">Spanish (Spain)</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleTestVoice} disabled={ttsSample} className="gs-btn-ghost text-[#8B5CF6]">
                  {ttsSample ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
                  {ttsSample ? "Speaking..." : "Test Voice"}
                </Button>
                <p className="text-xs text-[var(--ag-text-muted)]">Plays a sample phrase with your current settings.</p>
              </div>
              <div className="rounded-lg bg-[#8B5CF6]/5 border border-[#8B5CF6]/15 px-4 py-3 flex items-start gap-3">
                <Mic className="w-4 h-4 text-[#8B5CF6] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-[var(--ag-text-primary)] font-medium">Keyboard Shortcut</p>
                  <p className="text-xs text-[var(--ag-text-muted)] mt-0.5">Press Alt + V anywhere to open Voice Chat instantly.</p>
                </div>
              </div>
            </div>
          </div>
        </div>}
      </div>

      {/* App Version Footer */}
      {appVersion && (
        <div className="mt-6 text-center">
          <p className="text-xs text-[#4B5563]">Agentin v{appVersion}</p>
        </div>
      )}
    </div>
    </PageShell>
  );
}
