import {
  Bell,
  Brain,
  Eye,
  Key,
  Laptop,
  Mic,
  Palette,
  Save,
  Settings,
  Shield,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { DashboardPageWrapper, PageShell } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { MobilePageHeader } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import {
  agentService,
  apiKeyService,
  authService,
  memoryService,
  modelService,
  type UserSession,
  userService,
  versionService,
} from '@/services/api';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import type { ConversationEntry, FreeModel, MemoryEntry } from '@/types';
import type {
  AgentNotifsState,
  ApiKeyEntry,
  NotificationsState,
  PrivacyState,
  ProfileData,
  SettingsNavItem,
  VoiceSettings,
} from './settings';
import {
  ApiKeysTab,
  MemoryTab,
  NotificationsTab,
  PrivacyTab,
  ProfileTab,
  SecurityTab,
  SessionsTab,
  SettingsMobileMenu,
  SettingsNav,
  ShortcutsModal,
  ThemeTab,
  useSettingsExports,
  VoiceTab,
} from './settings';

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV_TABS: SettingsNavItem[] = [
  { id: 'profile', label: 'Profile', icon: User, description: 'Name, avatar, bio' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alerts & digest' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Password & AI model' },
  { id: 'sessions', label: 'Sessions', icon: Laptop, description: 'Active devices' },
  { id: 'apikeys', label: 'API Keys', icon: Key, description: 'External integrations' },
  { id: 'memory', label: 'Memory', icon: Brain, description: 'Stored context' },
  { id: 'privacy', label: 'Privacy', icon: Eye, description: 'Visibility controls' },
  { id: 'theme', label: 'Theme', icon: Palette, description: 'Appearance & accents' },
  { id: 'voice', label: 'Voice', icon: Mic, description: 'TTS preferences' },
] as const;

export function SettingsPage() {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const showSavedToast = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };
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

  // ─── Active tab + mobile drill-down ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('profile');
  /** mobileView: 'menu' = category list, 'detail' = section content */
  const [mobileView, setMobileView] = useState<'menu' | 'detail'>('menu');

  const handleMobileSelect = (id: string) => {
    setActiveTab(id);
    setMobileView('detail');
  };
  const handleMobileBack = () => setMobileView('menu');

  const [detectedTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  });

  // ─── Voice settings ────────────────────────────────────────────────────────
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
      try {
        localStorage.setItem('agentin_voice_settings', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleTestVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      'Hello! I am your Agentin AI assistant. How can I help you today?',
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
    versionService
      .get()
      .then(({ data }) => setAppVersion(data.version))
      .catch(() => {});
    agentService
      .getConfig()
      .then(({ data }) => {
        setAgentNotifs({
          notif_reminders: data.notif_reminders ?? 1,
          notif_escalations: data.notif_escalations ?? 1,
          notif_agents: data.notif_agents ?? 1,
          notif_daily_briefing: data.notif_daily_briefing ?? 1,
          notif_connections: data.notif_connections ?? 1,
        });
        if (data.preferred_free_model) setPreferredFreeModel(data.preferred_free_model as string);
        if (data.snooze_presets) {
          try {
            setSnoozePresets(JSON.parse(data.snooze_presets as string) as string[]);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
  }, []);

  const setUser = useAuthStore((s) => s.setUser);
  const compactMode = useAuthStore((s) => s.compactMode);
  const setCompactMode = useAuthStore((s) => s.setCompactMode);
  const {
    mode: themeMode,
    accentColor,
    accentPresets,
    setMode: setThemeMode,
    setAccentColor,
    setBackground,
  } = useThemeStore();

  // ─── Profile ───────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileData>({
    name: user?.name ?? user?.email?.split('@')[0] ?? '',
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || '',
    avatar: user?.avatar || '',
  });

  // ─── Notifications ─────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<NotificationsState>({
    emailReminders: user?.notifications?.email ?? true,
    pushNotifications: user?.notifications?.push ?? false,
    weeklyDigest: user?.notifications?.weeklyDigest ?? true,
    marketingEmails: false,
    securityAlerts: user?.notifications?.agentUpdates ?? true,
    reminderNotifs: user?.notifications?.reminders ?? true,
    connectionAlerts:
      (user?.notifications as Record<string, boolean> | undefined)?.connections ?? true,
    weeklyDigestToggle:
      (user?.notifications as Record<string, boolean> | undefined)?.digest ?? true,
  });
  const [agentNotifs, setAgentNotifs] = useState<AgentNotifsState>({
    notif_reminders: 1,
    notif_escalations: 1,
    notif_agents: 1,
    notif_daily_briefing: 1,
    notif_connections: 1,
  });
  const [snoozePresets, setSnoozePresets] = useState<string[]>(['1h', 'tomorrow', 'next-week']);

  // ─── Privacy ───────────────────────────────────────────────────────────────
  const [privacy, setPrivacy] = useState<PrivacyState>({
    showProfile: user?.privacy?.showProfile ?? true,
    showActivity: user?.privacy?.showActivity ?? true,
    allowAgentChat: user?.privacy?.allowAgentChat ?? true,
    showLocation: user?.privacy?.showLocation ?? true,
  });

  // ─── API Keys ──────────────────────────────────────────────────────────────
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState<ApiKeyEntry['provider']>('openai');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showAddKey, setShowAddKey] = useState(false);
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [rotateValue, setRotateValue] = useState('');
  const [isRotating, setIsRotating] = useState(false);

  // ─── Sessions ──────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // ─── Security / Model ──────────────────────────────────────────────────────
  const [preferredModel, setPreferredModel] = useState('auto');
  const [modelSaving, setModelSaving] = useState(false);
  const [preferredFreeModel, setPreferredFreeModel] = useState('auto');
  const [freeModels, setFreeModels] = useState<FreeModel[]>([]);
  const [freeModelSaving, setFreeModelSaving] = useState(false);

  // ─── Password ──────────────────────────────────────────────────────────────
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // ─── Delete account ────────────────────────────────────────────────────────
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  // ─── Privacy saving ────────────────────────────────────────────────────────
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // ─── Memory ────────────────────────────────────────────────────────────────
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryFilter, setMemoryFilter] = useState<string>('all');
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [reactionSummary, setReactionSummary] = useState<{ reaction: string; count: number }[]>([]);
  const [starredMessages, setStarredMessages] = useState<ConversationEntry[]>([]);
  const [showStarred, setShowStarred] = useState(false);

  // ─── Theme / bg ────────────────────────────────────────────────────────────
  const [bgVibe, setBgVibe] = useState('');
  const [bgPreview, setBgPreview] = useState<{
    gradient: string;
    name: string;
    accent: string;
  } | null>(null);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);

  // ─── Agent config reset ────────────────────────────────────────────────────
  const [isResettingAgent, setIsResettingAgent] = useState(false);

  // ─── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    apiKeyService
      .list()
      .then(({ data }) => {
        setApiKeys(
          data.map((k) => ({
            id: k.id,
            provider: k.provider,
            label: k.label,
            maskedKey: k.maskedKey,
          })),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'memory') {
      memoryService
        .getReactionSummary()
        .then(({ data }) => setReactionSummary(data.reactions))
        .catch(() => {});
      agentService
        .getStarred()
        .then(({ data }) => setStarredMessages(data.messages))
        .catch(() => {});
      setMemoriesLoading(true);
      memoryService
        .list(memoryFilter === 'all' ? undefined : memoryFilter)
        .then(({ data }) => setMemories(data))
        .catch(() => {})
        .finally(() => setMemoriesLoading(false));
    }
  }, [activeTab, memoryFilter]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      setSessionsLoading(true);
      userService
        .getSessions()
        .then(({ data }) => setSessions(data.sessions))
        .catch(() => {})
        .finally(() => setSessionsLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'security') {
      userService
        .getPreferredModel()
        .then(({ data }) => setPreferredModel(data.preferredModel))
        .catch(() => {});
      modelService
        .getFreeModels()
        .then(({ data }) =>
          setFreeModels(data.models.filter((m) => m.status === 'active' || m.status === 'new')),
        )
        .catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
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

  // ─── Handlers ──────────────────────────────────────────────────────────────
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
      await userService.updateProfile({
        privacy,
      } as Parameters<typeof userService.updateProfile>[0]);
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
      await userService.updateProfile({
        privacy: { [key]: checked },
      } as Parameters<typeof userService.updateProfile>[0]);
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
      await userService.updateProfile({
        notifications: { [serverKey]: value },
      } as Parameters<typeof userService.updateProfile>[0]);
    } catch {
      setNotifications((prev) => ({ ...prev, [field]: !value }));
    }
  };

  const handleAgentNotifChange = (key: keyof AgentNotifsState, value: number) => {
    const updated = { ...agentNotifs, [key]: value };
    setAgentNotifs(updated);
    void agentService
      .updateConfig({ [key]: value })
      .then(() => showSavedToast())
      .catch(() => {});
  };

  const handleSnoozePresetChange = (preset: string, enabled: boolean) => {
    const updated = enabled
      ? [...snoozePresets, preset]
      : snoozePresets.filter((p) => p !== preset);
    setSnoozePresets(updated);
    void agentService
      .updateConfig({ snooze_presets: JSON.stringify(updated) })
      .then(() => showSavedToast())
      .catch(() => {});
  };

  const handleResetAgentConfig = async () => {
    setIsResettingAgent(true);
    try {
      const defaultNotifs: AgentNotifsState = {
        notif_reminders: 1,
        notif_escalations: 1,
        notif_agents: 1,
        notif_daily_briefing: 1,
        notif_connections: 1,
      };
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
    } catch {
      /* silently fail */
    } finally {
      setIsResettingAgent(false);
    }
  };

  const handleSaveModel = async (model: string) => {
    setModelSaving(true);
    try {
      await userService.setPreferredModel(model);
      setPreferredModel(model);
    } catch {
      /* ignore */
    } finally {
      setModelSaving(false);
    }
  };

  const handleSaveFreeModel = async (val: string) => {
    setPreferredFreeModel(val);
    setFreeModelSaving(true);
    try {
      await agentService.updateConfig({ preferred_free_model: val });
      showSavedToast();
    } catch {
      /* ignore */
    } finally {
      setFreeModelSaving(false);
    }
  };

  const handleChangePassword = async () => {
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
      const axiosErr = err as {
        response?: { data?: { error?: string; message?: string } };
      };
      setPwError(
        axiosErr?.response?.data?.error ||
          axiosErr?.response?.data?.message ||
          'Failed to update password. Please try again.',
      );
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      await authService.deleteUserAccount(deletePassword);
      logout();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string } };
      };
      setDeleteError(
        axiosErr?.response?.data?.error ||
          'Failed to delete account. Check your password and try again.',
      );
    } finally {
      setIsDeleting(false);
    }
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
      setApiKeys([
        ...apiKeys,
        {
          id: data.id,
          provider: data.provider,
          label: data.label,
          maskedKey: data.maskedKey,
        },
      ]);
    } catch {
      const masked = newKeyValue.slice(0, 3) + '...' + newKeyValue.slice(-4);
      setApiKeys([
        ...apiKeys,
        {
          id: Date.now().toString(),
          provider: newKeyProvider,
          label: newKeyProvider.charAt(0).toUpperCase() + newKeyProvider.slice(1),
          maskedKey: masked,
        },
      ]);
    }
    setNewKeyValue('');
    setShowAddKey(false);
  };

  const handleRotateKey = async (id: string) => {
    if (!rotateValue.trim() || rotateValue.trim().length < 8) return;
    setIsRotating(true);
    try {
      const { data } = await apiKeyService.rotate(id, rotateValue.trim());
      setApiKeys(apiKeys.map((k) => (k.id === id ? { ...k, maskedKey: data.maskedKey } : k)));
      setRotatingKeyId(null);
      setRotateValue('');
    } catch {
      /* silently fail */
    } finally {
      setIsRotating(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await memoryService.delete(memoryId);
      setMemories(memories.filter((m) => m.id !== memoryId));
    } catch {
      /* keep local state */
    }
  };

  const handleGenerateBg = async () => {
    setIsGeneratingBg(true);
    try {
      const { data } = await agentService.generateBackground(bgVibe || undefined);
      setBgPreview(data);
    } catch {
      /* ignore */
    } finally {
      setIsGeneratingBg(false);
    }
  };

  const handleApplyBg = async () => {
    if (!bgPreview) return;
    setBackground(bgPreview.gradient);
    await userService.updateProfile({
      theme_background: bgPreview.gradient,
    } as Parameters<typeof userService.updateProfile>[0]);
  };

  const handleThemeModeChange = (mode: 'dark' | 'light' | 'system') => {
    setThemeMode(mode);
    void userService.updateProfile({
      theme: { mode },
    } as Parameters<typeof userService.updateProfile>[0]);
  };

  const handleAccentChange = (color: string) => {
    setAccentColor(color);
    void agentService
      .updateConfig({ accentColor: color })
      .then(() => showSavedToast())
      .catch(() => {});
  };

  // ─── Active nav item label (mobile header) ─────────────────────────────────
  const activeNavItem = NAV_TABS.find((t) => t.id === activeTab);

  // ─── Tab content (shared between mobile detail + desktop) ──────────────────
  const tabContent = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-w-0">
      <TabsContent value="profile" className="space-y-6 mt-0">
        <ProfileTab
          profile={profile}
          setProfile={setProfile}
          user={user}
          avatarError={avatarError}
          setAvatarError={setAvatarError}
          setHasUnsavedChanges={setHasUnsavedChanges}
        />
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6 mt-0">
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

      <TabsContent value="sessions" className="space-y-6 mt-0">
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

      <TabsContent value="security" className="space-y-6 mt-0">
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

      <TabsContent value="apikeys" className="space-y-6 mt-0">
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

      <TabsContent value="memory" className="space-y-6 mt-0">
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

      <TabsContent value="privacy" className="space-y-6 mt-0">
        <PrivacyTab
          privacy={privacy}
          savingPrivacy={savingPrivacy}
          handlePrivacySave={() => void handlePrivacySave()}
          onPrivacyToggle={handlePrivacyToggle}
        />
      </TabsContent>

      <TabsContent value="theme" className="space-y-6 mt-0">
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

      <TabsContent value="voice" className="space-y-6 mt-0">
        <VoiceTab
          voiceSettings={voiceSettings}
          saveVoiceSettings={saveVoiceSettings}
          ttsSample={ttsSample}
          handleTestVoice={handleTestVoice}
        />
      </TabsContent>
    </Tabs>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardPageWrapper>
      <PageShell>
        <div data-testid="settings-page" className="animate-in fade-in duration-500 pb-24 md:pb-6">
          {/* ── Saved toast — landing glass style ──────────────────────── */}
          {savedToast && (
            <div
              className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 text-[#C4B5FD] text-xs font-mono tracking-wide shadow-[0_0_20px_rgba(139,92,246,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-300"
              data-testid="settings-saved-toast"
            >
              <Save className="w-3.5 h-3.5" />
              Settings saved
            </div>
          )}

          {/* ── Shortcuts modal ─────────────────────────────────────────── */}
          {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

          {/* ════════════════════════════════════════════════════════════════
						MOBILE — drill-down pattern (hidden md+)
					════════════════════════════════════════════════════════════════ */}
          <div className="md:hidden">
            {mobileView === 'menu' ? (
              /* ── Mobile top-level menu ──────────────────────────────── */
              <>
                <MobilePageHeader
                  title="Settings"
                  subtitle="Account & preferences"
                  actions={
                    <button
                      type="button"
                      onClick={() => setShowShortcuts(true)}
                      className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
                      aria-label="Keyboard shortcuts"
                      data-testid="shortcuts-btn"
                    >
                      <kbd className="font-mono text-[11px]">?</kbd>
                    </button>
                  }
                />
                <BlurFade delay={0.1}>
                  <div className="px-4 pt-4">
                    <SettingsMobileMenu
                      items={NAV_TABS}
                      onSelect={handleMobileSelect}
                      appVersion={appVersion}
                    />
                  </div>
                </BlurFade>
              </>
            ) : (
              /* ── Mobile drill-down detail view ──────────────────────── */
              <>
                <MobilePageHeader
                  title={activeNavItem?.label ?? 'Settings'}
                  subtitle={activeNavItem?.description}
                  onBack={handleMobileBack}
                  actions={
                    activeTab === 'profile' ? (
                      <Button
                        size="sm"
                        onClick={() => void handleSave()}
                        disabled={isSaving}
                        className="min-h-[44px] bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold px-3 rounded-xl shadow-[0_0_16px_rgba(139,92,246,0.3)]"
                      >
                        {isSaving ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                    ) : undefined
                  }
                />
                <BlurFade delay={0.05}>
                  <div className="px-0 pt-4">{tabContent}</div>
                </BlurFade>
              </>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
						DESKTOP — sidebar + content (hidden <md)
					════════════════════════════════════════════════════════════════ */}
          <div className="hidden md:block space-y-6">
            <BlurFade delay={0.1}>
              {/* Desktop header — landing page visual language */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  {/* Icon badge */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <Settings className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div>
                    {/* Eyebrow */}
                    <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#8B5CF6]/70 block mb-0.5">
                      Account
                    </span>
                    <h1 className="text-xl font-heading font-bold text-[#F1F5F9] leading-tight">
                      Settings
                    </h1>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasUnsavedChanges && !isSaving && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B]/80 font-mono text-[11px] uppercase tracking-wide">
                      Unsaved
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowShortcuts(true)}
                    className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] text-[#94A3B8] hover:text-[#F1F5F9] text-xs transition-colors duration-150"
                    title="Keyboard shortcuts (?)"
                    data-testid="shortcuts-btn"
                  >
                    <kbd className="font-mono text-[11px]">?</kbd>
                    <span>Shortcuts</span>
                  </button>
                  <Button
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    className="min-h-[44px] bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-xl transition-all duration-200 shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)]"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </BlurFade>

            <BlurFade delay={0.2}>
              {/* Sidebar + content */}
              <div className="flex gap-6 items-start">
                <SettingsNav items={NAV_TABS} activeId={activeTab} onSelect={setActiveTab} />
                <div className="flex-1 min-w-0 space-y-6">{tabContent}</div>
              </div>
            </BlurFade>

            {appVersion && (
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#6B7280]/60 text-center mt-4">
                Agentin v{appVersion}
              </p>
            )}
          </div>
        </div>
      </PageShell>
    </DashboardPageWrapper>
  );
}
