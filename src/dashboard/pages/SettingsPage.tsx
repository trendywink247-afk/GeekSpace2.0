import { useState, useEffect } from 'react';
import { PageShell, PageHeader } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import {
  User,
  Bell,
  Shield,
  Key,
  Save,
  Eye,
  Palette,
  Brain,
  Mic,
  Laptop,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import {
  userService,
  apiKeyService,
  memoryService,
  agentService,
  versionService,
  modelService,
  authService,
  type UserSession,
} from '@/services/api';
import type { MemoryEntry, FreeModel, ConversationEntry } from '@/types';

import {
  ProfileTab,
  NotificationsTab,
  SessionsTab,
  SecurityTab,
  ApiKeysTab,
  MemoryTab,
  PrivacyTab,
  ThemeTab,
  VoiceTab,
  ShortcutsModal,
  useSettingsExports,
} from './settings';
import type {
  ProfileData,
  NotificationsState,
  AgentNotifsState,
  ApiKeyEntry,
  PrivacyState,
  VoiceSettings,
} from './settings';

export function SettingsPage() {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const showSavedToast = () => { setSavedToast(true); setTimeout(() => setSavedToast(false), 2000); };
  const {
    isExportingConversations,
    isExportingMarkdown,
    isExportingMarkdown7Days,
    isExportingGDPR,
    handleExportConversations,
    handleExportMarkdown,
    handleExportMarkdown7Days,
    handleGDPRExport,
  } = useSettingsExports();
  const [activeTab, setActiveTab] = useState('profile');
  const [detectedTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
  });

  // Voice settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
    try {
      const raw = localStorage.getItem('agentin_voice_settings');
      if (raw) return JSON.parse(raw) as VoiceSettings;
    } catch {}
    return { enabled: false, rate: 1, lang: 'en-US' };
  });
  const [ttsSample, setTtsSample] = useState(false);

  const saveVoiceSettings = (patch: Partial<VoiceSettings>) => {
    setVoiceSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem('agentin_voice_settings', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleTestVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      'Hello! I am your Agentin AI assistant. How can I help you today?'
    );
    u.rate = voiceSettings.rate;
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang === voiceSettings.lang) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      null;
    if (voice) u.voice = voice;
    u.onstart = () => setTtsSample(true);
    u.onend = () => setTtsSample(false);
    u.onerror = () => setTtsSample(false);
    window.speechSynthesis.speak(u);
  };

  const [showShortcuts, setShowShortcuts] = useState(false);
  const user = useAuthStore((s) => s.user);
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'weebo', page: 'settings' });
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    versionService.get().then(({ data }) => setAppVersion(data.version)).catch(() => {});
    agentService.getConfig().then(({ data }) => {
      setAgentNotifs({
        notif_reminders: data.notif_reminders ?? 1,
        notif_escalations: data.notif_escalations ?? 1,
        notif_agents: data.notif_agents ?? 1,
        notif_daily_briefing: data.notif_daily_briefing ?? 1,
        notif_connections: data.notif_connections ?? 1,
      });
      if (data.preferred_free_model) setPreferredFreeModel(data.preferred_free_model as string);
      if (data.snooze_presets) {
        try { setSnoozePresets(JSON.parse(data.snooze_presets as string) as string[]); } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, []);

  const setUser = useAuthStore((s) => s.setUser);
  const compactMode = useAuthStore((s) => s.compactMode);
  const setCompactMode = useAuthStore((s) => s.setCompactMode);
  const { mode: themeMode, accentColor, accentPresets, setMode: setThemeMode, setAccentColor, setBackground } = useThemeStore();

  // ─── Profile ─────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileData>({
    name: user?.name ?? user?.email?.split('@')[0] ?? '',
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || '',
    avatar: user?.avatar || '',
  });

  // ─── Notifications ────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<NotificationsState>({
    emailReminders: user?.notifications?.email ?? true,
    pushNotifications: user?.notifications?.push ?? false,
    weeklyDigest: user?.notifications?.weeklyDigest ?? true,
    marketingEmails: false,
    securityAlerts: user?.notifications?.agentUpdates ?? true,
    reminderNotifs: user?.notifications?.reminders ?? true,
    connectionAlerts: (user?.notifications as Record<string, boolean> | undefined)?.connections ?? true,
    weeklyDigestToggle: (user?.notifications as Record<string, boolean> | undefined)?.digest ?? true,
  });

  const [agentNotifs, setAgentNotifs] = useState<AgentNotifsState>({
    notif_reminders: 1,
    notif_escalations: 1,
    notif_agents: 1,
    notif_daily_briefing: 1,
    notif_connections: 1,
  });

  const [snoozePresets, setSnoozePresets] = useState<string[]>(['1h', 'tomorrow', 'next-week']);

  // ─── Privacy ──────────────────────────────────────────────────────────────────
  const [privacy, setPrivacy] = useState<PrivacyState>({
    showProfile: user?.privacy?.showProfile ?? true,
    showActivity: user?.privacy?.showActivity ?? true,
    allowAgentChat: user?.privacy?.allowAgentChat ?? true,
    showLocation: user?.privacy?.showLocation ?? true,
  });

  // ─── API Keys ─────────────────────────────────────────────────────────────────
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState<ApiKeyEntry['provider']>('openai');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showAddKey, setShowAddKey] = useState(false);
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [rotateValue, setRotateValue] = useState('');
  const [isRotating, setIsRotating] = useState(false);

  // ─── Sessions ─────────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // ─── Security / Model ─────────────────────────────────────────────────────────
  const [preferredModel, setPreferredModel] = useState('auto');
  const [modelSaving, setModelSaving] = useState(false);
  const [preferredFreeModel, setPreferredFreeModel] = useState('auto');
  const [freeModels, setFreeModels] = useState<FreeModel[]>([]);
  const [freeModelSaving, setFreeModelSaving] = useState(false);

  // ─── Password ────────────────────────────────────────────────────────────────
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // ─── Delete account ──────────────────────────────────────────────────────────
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  // ─── Privacy saving ───────────────────────────────────────────────────────────
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // ─── Memory ───────────────────────────────────────────────────────────────────
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryFilter, setMemoryFilter] = useState<string>('all');
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [reactionSummary, setReactionSummary] = useState<{ reaction: string; count: number }[]>([]);
  const [starredMessages, setStarredMessages] = useState<ConversationEntry[]>([]);
  const [showStarred, setShowStarred] = useState(false);

  // ─── Theme / bg ───────────────────────────────────────────────────────────────
  const [bgVibe, setBgVibe] = useState('');
  const [bgPreview, setBgPreview] = useState<{ gradient: string; name: string; accent: string } | null>(null);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);

  // ─── Agent config reset ───────────────────────────────────────────────────────
  const [isResettingAgent, setIsResettingAgent] = useState(false);

  // ─── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    apiKeyService.list().then(({ data }) => {
      setApiKeys(data.map((k) => ({ id: k.id, provider: k.provider, label: k.label, maskedKey: k.maskedKey })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'memory') {
      memoryService.getReactionSummary().then(({ data }) => setReactionSummary(data.reactions)).catch(() => {});
      agentService.getStarred().then(({ data }) => setStarredMessages(data.messages)).catch(() => {});
      setMemoriesLoading(true);
      memoryService.list(memoryFilter === 'all' ? undefined : memoryFilter)
        .then(({ data }) => setMemories(data))
        .catch(() => {})
        .finally(() => setMemoriesLoading(false));
    }
  }, [activeTab, memoryFilter]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      setSessionsLoading(true);
      userService.getSessions()
        .then(({ data }) => setSessions(data.sessions))
        .catch(() => {})
        .finally(() => setSessionsLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'security') {
      userService.getPreferredModel()
        .then(({ data }) => setPreferredModel(data.preferredModel))
        .catch(() => {});
      modelService.getFreeModels()
        .then(({ data }) => setFreeModels(data.models.filter((m) => m.status === 'active' || m.status === 'new')))
        .catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (hasUnsavedChanges) e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

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

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: updatedUser } = await userService.updateProfile(profile);
      if (user && updatedUser) setUser({ ...user, ...updatedUser });
      setHasUnsavedChanges(false);
      void notifyDone('Profile saved');
    } catch {
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

  const handlePrivacyToggle = async (key: keyof PrivacyState, checked: boolean) => {
    const prev = { ...privacy };
    setPrivacy({ ...privacy, [key]: checked });
    try {
      await userService.updateProfile({ privacy: { [key]: checked } } as Parameters<typeof userService.updateProfile>[0]);
      showSavedToast();
    } catch {
      setPrivacy(prev);
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
      setNotifications((prev) => ({ ...prev, [field]: !value }));
    }
  };

  const handleAgentNotifChange = (key: keyof AgentNotifsState, value: number) => {
    const updated = { ...agentNotifs, [key]: value };
    setAgentNotifs(updated);
    void agentService.updateConfig({ [key]: value }).then(() => showSavedToast()).catch(() => {});
  };

  const handleSnoozePresetChange = (preset: string, enabled: boolean) => {
    const updated = enabled
      ? [...snoozePresets, preset]
      : snoozePresets.filter((p) => p !== preset);
    setSnoozePresets(updated);
    void agentService.updateConfig({ snooze_presets: JSON.stringify(updated) }).then(() => showSavedToast()).catch(() => {});
  };

  const handleResetAgentConfig = async () => {
    setIsResettingAgent(true);
    try {
      const defaultNotifs: AgentNotifsState = { notif_reminders: 1, notif_escalations: 1, notif_agents: 1, notif_daily_briefing: 1, notif_connections: 1 };
      const defaultPresets = ['1h', 'tomorrow', 'next-week'];
      const defaultModel = 'auto';
      await agentService.updateConfig({ ...defaultNotifs, snooze_presets: JSON.stringify(defaultPresets), preferred_free_model: defaultModel });
      setAgentNotifs(defaultNotifs);
      setSnoozePresets(defaultPresets);
      setPreferredFreeModel(defaultModel);
      showSavedToast();
    } catch { /* silently fail */ } finally { setIsResettingAgent(false); }
  };

  const handleSaveModel = async (model: string) => {
    setModelSaving(true);
    try {
      await userService.setPreferredModel(model);
      setPreferredModel(model);
    } catch { /* ignore */ } finally { setModelSaving(false); }
  };

  const handleSaveFreeModel = async (val: string) => {
    setPreferredFreeModel(val);
    setFreeModelSaving(true);
    try {
      await agentService.updateConfig({ preferred_free_model: val });
      showSavedToast();
    } catch { /* ignore */ } finally { setFreeModelSaving(false); }
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (pwNew !== pwConfirm) { setPwError('New passwords do not match.'); return; }
    if (pwNew.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    setPwSaving(true);
    try {
      await userService.changePassword(pwCurrent, pwNew);
      setPwSuccess('Password updated successfully.');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
      setPwError(axiosErr?.response?.data?.error || axiosErr?.response?.data?.message || 'Failed to update password. Please try again.');
    } finally { setPwSaving(false); }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      await authService.deleteUserAccount(deletePassword);
      logout();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setDeleteError(axiosErr?.response?.data?.error || 'Failed to delete account. Check your password and try again.');
    } finally { setIsDeleting(false); }
  };

  const handleRevokeSession = async (sessionId: string) => {
    await userService.revokeSession(sessionId).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleRevokeAllSessions = async () => {
    await userService.revokeAllSessions().catch(() => {});
    setSessions([]);
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
      setApiKeys(apiKeys.map((k) => k.id === id ? { ...k, maskedKey: data.maskedKey } : k));
      setRotatingKeyId(null);
      setRotateValue('');
    } catch { /* silently fail */ } finally { setIsRotating(false); }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await memoryService.delete(memoryId);
      setMemories(memories.filter((m) => m.id !== memoryId));
    } catch { /* keep local state */ }
  };

  const handleGenerateBg = async () => {
    setIsGeneratingBg(true);
    try {
      const { data } = await agentService.generateBackground(bgVibe || undefined);
      setBgPreview(data);
    } catch { /* ignore */ } finally { setIsGeneratingBg(false); }
  };

  const handleApplyBg = async () => {
    if (!bgPreview) return;
    setBackground(bgPreview.gradient);
    await userService.updateProfile({ theme_background: bgPreview.gradient } as Parameters<typeof userService.updateProfile>[0]);
  };

  const handleThemeModeChange = (mode: 'dark' | 'light' | 'system') => {
    setThemeMode(mode);
    void userService.updateProfile({ theme: { mode } } as Parameters<typeof userService.updateProfile>[0]);
  };

  const handleAccentChange = (color: string) => {
    setAccentColor(color);
    void agentService.updateConfig({ accentColor: color }).then(() => showSavedToast()).catch(() => {});
  };

  // ─── Nav tabs config ──────────────────────────────────────────────────────────
  const NAV_TABS = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'sessions', label: 'Sessions', icon: Laptop },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'privacy', label: 'Privacy', icon: Eye },
    { id: 'theme', label: 'Theme', icon: Palette },
    { id: 'voice', label: 'Voice', icon: Mic },
  ] as const;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <DashboardPageWrapper>
      <PageShell>
        <div data-testid="settings-page" className="space-y-6 animate-in fade-in duration-500 pb-24 md:pb-6">
          {/* Save confirmation toast */}
          {savedToast && (
            <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A78BFA]/15 border border-[var(--ag-cyan)]/40 text-[var(--ag-cyan)] text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="settings-saved-toast">
              <Save className="w-4 h-4" />
              Settings saved
            </div>
          )}

          {/* Keyboard shortcut cheat sheet modal */}
          {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

          <BlurFade delay={0.1}>
            <PageHeader
              icon={Settings}
              title="Settings"
              subtitle="Manage your account preferences"
              badge={
                <>
                  <span className="relative flex h-2.5 w-2.5" title="Weebo active">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A78BFA] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#A78BFA]" />
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
                    className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] hover:border-[var(--ag-cyan)]/40 text-xs min-h-[44px]"
                    title="Keyboard shortcuts (?)"
                    data-testid="shortcuts-btn"
                  >
                    <kbd className="text-xs font-mono mr-1">?</kbd>Shortcuts
                  </Button>
                  <Button
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-[#8B5CF6] to-[#D97706] hover:from-[#7C3AED] hover:to-[#C2410C] min-h-[44px] text-white font-semibold transition-all duration-200"
                  >
                    {isSaving ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" />Save Changes</>
                    )}
                  </Button>
                </div>
              }
            />
          </BlurFade>

          {/* Section quick-nav */}
          <BlurFade delay={0.2}>
            <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1 -mb-2 whitespace-nowrap -webkit-overflow-scrolling-touch">
              {NAV_TABS.map(({ id, label, icon: NavIcon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setActiveTab(id);
                    document.getElementById('settings-tabs-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    activeTab === id
                      ? 'bg-[#A78BFA]/15 text-[var(--ag-cyan)] border border-[var(--ag-cyan)]/40'
                      : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] border border-transparent hover:border-[rgba(139,92,246,0.15)]'
                  }`}
                >
                  <NavIcon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </nav>
          </BlurFade>

          <BlurFade delay={0.3}>
            <Tabs id="settings-tabs-anchor" value={activeTab} onValueChange={setActiveTab} className="space-y-6">

              <TabsContent value="profile" className="space-y-6">
                <ProfileTab
                  profile={profile}
                  setProfile={setProfile}
                  user={user}
                  avatarError={avatarError}
                  setAvatarError={setAvatarError}
                  setHasUnsavedChanges={setHasUnsavedChanges}
                />
              </TabsContent>

              <TabsContent value="notifications" className="space-y-6">
                <NotificationsTab
                  notifications={notifications}
                  setNotifications={setNotifications}
                  agentNotifs={agentNotifs}
                  setAgentNotifs={setAgentNotifs}
                  snoozePresets={snoozePresets}
                  setSnoozePresets={setSnoozePresets}
                  isResettingAgent={isResettingAgent}
                  handleResetAgentConfig={() => void handleResetAgentConfig()}
                  showSavedToast={showSavedToast}
                  saveNotification={saveNotification}
                  onAgentNotifChange={handleAgentNotifChange}
                  onSnoozePresetChange={handleSnoozePresetChange}
                />
              </TabsContent>

              <TabsContent value="sessions" className="space-y-6">
                <SessionsTab
                  sessions={sessions}
                  setSessions={setSessions}
                  sessionsLoading={sessionsLoading}
                  detectedTimezone={detectedTimezone}
                  isExportingGDPR={isExportingGDPR}
                  handleGDPRExport={() => void handleGDPRExport()}
                  handleRevokeSession={handleRevokeSession}
                  onRevokeAll={() => void handleRevokeAllSessions()}
                />
              </TabsContent>

              <TabsContent value="security" className="space-y-6">
                <SecurityTab
                  preferredModel={preferredModel}
                  handleSaveModel={handleSaveModel}
                  modelSaving={modelSaving}
                  preferredFreeModel={preferredFreeModel}
                  setPreferredFreeModel={setPreferredFreeModel}
                  freeModels={freeModels}
                  freeModelSaving={freeModelSaving}
                  setFreeModelSaving={setFreeModelSaving}
                  showSavedToast={showSavedToast}
                  onSaveFreeModel={handleSaveFreeModel}
                  pwCurrent={pwCurrent}
                  setPwCurrent={setPwCurrent}
                  pwNew={pwNew}
                  setPwNew={setPwNew}
                  pwConfirm={pwConfirm}
                  setPwConfirm={setPwConfirm}
                  pwError={pwError}
                  setPwError={setPwError}
                  pwSuccess={pwSuccess}
                  setPwSuccess={setPwSuccess}
                  pwSaving={pwSaving}
                  onChangePassword={() => void handleChangePassword()}
                  deletePassword={deletePassword}
                  setDeletePassword={setDeletePassword}
                  deleteConfirmText={deleteConfirmText}
                  setDeleteConfirmText={setDeleteConfirmText}
                  deleteError={deleteError}
                  setDeleteError={setDeleteError}
                  isDeleting={isDeleting}
                  showDeleteConfirm={showDeleteConfirm}
                  setShowDeleteConfirm={setShowDeleteConfirm}
                  onDeleteAccount={() => void handleDeleteAccount()}
                />
              </TabsContent>

              <TabsContent value="apikeys" className="space-y-6">
                <ApiKeysTab
                  apiKeys={apiKeys}
                  setApiKeys={setApiKeys}
                  newKeyProvider={newKeyProvider}
                  setNewKeyProvider={setNewKeyProvider}
                  newKeyValue={newKeyValue}
                  setNewKeyValue={setNewKeyValue}
                  showAddKey={showAddKey}
                  setShowAddKey={setShowAddKey}
                  rotatingKeyId={rotatingKeyId}
                  setRotatingKeyId={setRotatingKeyId}
                  rotateValue={rotateValue}
                  setRotateValue={setRotateValue}
                  isRotating={isRotating}
                  handleAddKey={handleAddKey}
                  handleRotateKey={handleRotateKey}
                />
              </TabsContent>

              <TabsContent value="memory" className="space-y-6">
                <MemoryTab
                  memories={memories}
                  memoryFilter={memoryFilter}
                  setMemoryFilter={setMemoryFilter}
                  memoriesLoading={memoriesLoading}
                  reactionSummary={reactionSummary}
                  starredMessages={starredMessages}
                  setStarredMessages={setStarredMessages}
                  showStarred={showStarred}
                  setShowStarred={setShowStarred}
                  handleDeleteMemory={handleDeleteMemory}
                  isExportingConversations={isExportingConversations}
                  handleExportConversations={() => void handleExportConversations()}
                  isExportingMarkdown={isExportingMarkdown}
                  handleExportMarkdown={() => void handleExportMarkdown()}
                  isExportingMarkdown7Days={isExportingMarkdown7Days}
                  handleExportMarkdown7Days={() => void handleExportMarkdown7Days()}
                />
              </TabsContent>

              <TabsContent value="privacy" className="space-y-6">
                <PrivacyTab
                  privacy={privacy}
                  savingPrivacy={savingPrivacy}
                  handlePrivacySave={() => void handlePrivacySave()}
                  onPrivacyToggle={handlePrivacyToggle}
                />
              </TabsContent>

              <TabsContent value="theme" className="space-y-6">
                <ThemeTab
                  themeMode={themeMode}
                  setThemeMode={setThemeMode}
                  accentColor={accentColor}
                  setAccentColor={setAccentColor}
                  accentPresets={accentPresets}
                  compactMode={compactMode}
                  setCompactMode={setCompactMode}
                  bgVibe={bgVibe}
                  setBgVibe={setBgVibe}
                  bgPreview={bgPreview}
                  isGeneratingBg={isGeneratingBg}
                  handleGenerateBg={() => void handleGenerateBg()}
                  handleApplyBg={() => void handleApplyBg()}
                  onThemeModeChange={handleThemeModeChange}
                  onAccentChange={handleAccentChange}
                />
              </TabsContent>

              <TabsContent value="voice" className="space-y-6">
                <VoiceTab
                  voiceSettings={voiceSettings}
                  saveVoiceSettings={saveVoiceSettings}
                  ttsSample={ttsSample}
                  handleTestVoice={handleTestVoice}
                />
              </TabsContent>

            </Tabs>
          </BlurFade>

          {appVersion && (
            <div className="mt-6 text-center">
              <p className="text-xs text-[var(--ag-text-muted)]">Agentin v{appVersion}</p>
            </div>
          )}


        </div>
      </PageShell>
    </DashboardPageWrapper>
  );
}
