import { useState, useEffect, useRef, useCallback } from 'react';
import { PageShell, PageHeader, PageWrapper } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import {
  Save, Plus, Eye, Share2, ExternalLink, CheckCircle2, Copy, MessageCircle, Link,
  User, Code2, FolderGit2, Award, Bot, Lightbulb, BarChart3, Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth-store';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import { portfolioService, type PortfolioContact } from '@/services/api';
import type { Portfolio, PortfolioProject, PortfolioMilestone, PortfolioLayout } from '@/types';
import {
  ProfileTab, SkillsTab, ProjectsTab, MilestonesTab, SocialTab,
  AITab, SuggestionsTab, AnalyticsTab, PreviewTab, MessagesTab,
} from './portfolio';
import type { PortfolioSuggestion } from './portfolio';

/** Normalize social URL: don't prepend https:// if protocol already present. */
function normalizeSocialUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('mailto:')) return trimmed;
  return `https://${trimmed}`;
}

export function PortfolioPage() {
  const user = useAuthStore((s) => s.user);
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'nova', page: 'portfolio' });
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [contacts, setContacts] = useState<PortfolioContact[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const isDirty = useRef(false);
  const initialSnapshot = useRef<string>('');

  // Portfolio core state
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [layout, setLayout] = useState<PortfolioLayout>('classic');
  const [skills, setSkills] = useState<string[]>([]);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [milestones, setMilestones] = useState<PortfolioMilestone[]>([]);
  const [social, setSocial] = useState<Portfolio['social']>({});

  // Async data
  const [portfolioStats, setPortfolioStats] = useState<{ totalViews: number; recentViews: number; dailyBreakdown: { date: string; count: number }[] } | null>(null);
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PortfolioSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    portfolioService.get()
      .then(({ data }) => {
        setHeadline(data.headline || '');
        setAbout(data.about || '');
        setMetaDescription(data.meta_description || '');
        setAvatar(data.avatar || '');
        setLayout(data.layout || 'classic');
        setSkills(data.skills || []);
        setProjects(data.projects || []);
        setMilestones(data.milestones || []);
        setSocial(data.social || {});
        initialSnapshot.current = JSON.stringify({
          headline: data.headline || '', about: data.about || '', metaDescription: data.meta_description || '',
          avatar: data.avatar || '', layout: data.layout || 'classic', skills: data.skills || [],
          projects: data.projects || [], milestones: data.milestones || [], social: data.social || {},
        });
      })
      .catch(() => showMessage('error', 'Failed to load portfolio'))
      .finally(() => setIsLoading(false));

    loadSuggestions();
    portfolioService.getStats().then(({ data }) => setPortfolioStats(data)).catch(() => { /* non-fatal */ });
    portfolioService.getMeStats().then(({ data }) => setLastViewedAt(data.last_viewed_at)).catch(() => { /* non-fatal */ });
    portfolioService.getContacts().then(({ data }) => setContacts(data)).catch(() => { /* non-fatal */ });
  }, []);

  const currentSnapshot = useCallback(() => JSON.stringify({
    headline, about, metaDescription, avatar, layout, skills, projects, milestones, social,
  }), [headline, about, metaDescription, avatar, layout, skills, projects, milestones, social]);

  useEffect(() => {
    if (!isLoading && initialSnapshot.current) {
      isDirty.current = currentSnapshot() !== initialSnapshot.current;
    }
  }, [currentSnapshot, isLoading]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (isDirty.current) e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data } = await portfolioService.getSuggestions();
      setSuggestions(data);
    } catch { /* silent */ } finally {
      setLoadingSuggestions(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const applyPortfolioData = (data: Portfolio) => {
    setHeadline(data.headline || '');
    setAbout(data.about || '');
    setAvatar(data.avatar || '');
    setLayout(data.layout || 'classic');
    setSkills(data.skills || []);
    setProjects(data.projects || []);
    setMilestones(data.milestones || []);
    setSocial(data.social || {});
  };

  const handleSave = async () => {
    setIsSaving(true);
    const normalizedSocial = { ...social };
    for (const key of ['github', 'twitter', 'linkedin', 'website'] as const) {
      if (normalizedSocial[key]) normalizedSocial[key] = normalizeSocialUrl(normalizedSocial[key]!);
    }
    try {
      const { data } = await portfolioService.update({ headline, about, metaDescription, avatar, layout, skills, projects, milestones, social: normalizedSocial });
      applyPortfolioData(data);
      setMetaDescription(data.meta_description || '');
      initialSnapshot.current = JSON.stringify({
        headline: data.headline || '', about: data.about || '', metaDescription: data.meta_description || '',
        avatar: data.avatar || '', layout: data.layout || 'classic', skills: data.skills || [],
        projects: data.projects || [], milestones: data.milestones || [], social: data.social || {},
      });
      isDirty.current = false;
      showMessage('success', 'Portfolio saved successfully');
      await notifyDone('Portfolio saved');
    } catch {
      showMessage('error', 'Failed to save portfolio');
      await notifyFail('Portfolio save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (!user?.username) return;
    const url = `${window.location.origin}/portfolio/${user.username}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      showMessage('success', `Share this link: ${url}`);
    }
  };

  if (isLoading) {
    return (
      <PageShell maxWidth="5xl">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#EC4899] border-t-transparent rounded-full animate-spin" />
        </div>
      </PageShell>
    );
  }

  const completionItems: Array<{ label: string; done: boolean; tab: string }> = [
    { label: 'Add your headline', done: !!headline.trim(), tab: 'profile' },
    { label: 'Write your bio', done: !!about.trim(), tab: 'profile' },
    { label: 'Set your avatar URL', done: !!avatar.trim(), tab: 'profile' },
    { label: 'Add your skills', done: skills.length > 0, tab: 'skills' },
    { label: 'Add a project', done: projects.length > 0, tab: 'projects' },
    { label: 'Add a social link', done: Object.values(social || {}).some((v) => !!v), tab: 'social' },
    { label: 'Add a milestone', done: milestones.length > 0, tab: 'milestones' },
  ];
  const completedCount = completionItems.filter((i) => i.done).length;
  const completionPct = Math.round((completedCount / completionItems.length) * 100);

  return (
    <DashboardPageWrapper>
    <PageShell maxWidth="5xl">
    <PageWrapper>
    <div data-testid="portfolio-page" className="space-y-6">
      <PageHeader
        icon={Briefcase}
        title="Portfolio"
        subtitle="Manage your public portfolio"
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[var(--ag-nova)]/10 border border-[var(--ag-nova)]/30 text-[var(--ag-nova)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ag-nova)] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ag-nova)]" />
            </span>
            Nova
          </span>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {isDirty.current && !isSaving && (
              <div className="px-3 py-1.5 rounded-lg bg-[var(--ag-amber)]/10 border border-[var(--ag-amber)]/30 text-[var(--ag-amber)] text-xs">
                Unsaved changes
              </div>
            )}
            {portfolioStats !== null && (
              <span className="text-xs text-[var(--ag-text-secondary)] hidden sm:inline-flex items-center gap-1">
                <Eye className="w-3 h-3 text-[var(--ag-nova)]" />
                {portfolioStats.totalViews} views
                {lastViewedAt && (
                  <span className="ml-1" title={`Last viewed: ${new Date(lastViewedAt).toLocaleString(undefined, { timeZoneName: 'short' })}`}>
                    · {new Date(lastViewedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </span>
            )}
            {user?.username && (
              <>
                <button
                  onClick={handleCopyLink}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-all duration-300 min-h-[44px] ${linkCopied ? 'scale-105' : ''}`}
                  style={linkCopied ? { color: 'var(--ag-green)', borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', boxShadow: '0 0 12px rgba(16,185,129,0.15)' } : { color: 'var(--ag-nova)', borderColor: 'var(--ag-border-default)' }}
                  title="Copy portfolio link"
                >
                  {linkCopied ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  {linkCopied ? 'Copied!' : 'Copy Link'}
                </button>
                <a
                  href={`/portfolio/${user.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[var(--ag-violet)] border border-[var(--ag-border-default)] hover:border-[var(--ag-border-glow)] hover:bg-[var(--ag-violet)]/10 transition-colors min-h-[44px]"
                >
                  <ExternalLink className="w-4 h-4" />View Live
                </a>
              </>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 text-white border-0 min-h-[44px] press-scale shadow-lg hover:shadow-xl transition-all duration-300"
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

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] ${
          message.type === 'success' ? 'border-[var(--ag-green)]/30 text-[var(--ag-green)]' : 'border-[var(--ag-pink)]/30 text-[var(--ag-pink)]'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Completion */}
      {completionPct < 100 && (
        <div className="bg-[var(--ag-bg-surface)] backdrop-blur-xl rounded-xl p-6 shadow-[0_0_0_1px_rgba(139,92,246,0.12),0_4px_16px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[var(--ag-text-primary)] font-heading tabular-nums">
              Profile {completionPct}% complete
            </h3>
            <span className="text-xs text-[var(--ag-text-secondary)] tabular-nums">{completedCount}/{completionItems.length} fields</span>
          </div>
          <div className="w-full bg-[var(--ag-bg-base)] rounded-full h-2 mb-3">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${completionPct}%`,
                background: completionPct >= 80 ? 'var(--ag-green)' : completionPct >= 50 ? 'var(--ag-nova)' : 'var(--ag-amber)',
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {completionItems.filter((i) => !i.done).slice(0, 3).map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.tab)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-[var(--ag-nova)]/10 text-[var(--ag-nova)] border border-[var(--ag-nova)]/20 hover:bg-[var(--ag-nova)]/20 transition-colors min-h-[44px]"
              >
                <Plus className="w-3 h-3" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Share Card */}
      {user?.username && (
        <div className="bg-[var(--ag-bg-surface)] backdrop-blur-xl rounded-xl p-6 shadow-[0_0_0_1px_rgba(139,92,246,0.12),0_4px_16px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.1)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link className="w-4 h-4 text-[var(--ag-nova)]" />
                <h3 className="text-sm font-semibold text-[var(--ag-text-primary)] font-heading">Share Your Portfolio</h3>
              </div>
              <p className="text-xs text-[var(--ag-text-secondary)] truncate">
                {`${window.location.origin}/portfolio/${user.username}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleCopyLink}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-all duration-300 min-h-[44px] ${linkCopied ? 'scale-105' : ''}`}
                style={linkCopied
                  ? { color: 'var(--ag-green)', borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', boxShadow: '0 0 12px rgba(16,185,129,0.15)' }
                  : { color: 'var(--ag-nova)', borderColor: 'var(--ag-border-default)', background: 'transparent' }}
              >
                {linkCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={`/portfolio/${user.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors min-h-[44px] text-[var(--ag-violet)] border-[rgba(139,92,246,0.15)] hover:border-[rgba(139,92,246,0.3)] hover:bg-[#8B5CF6]/10"
              >
                <ExternalLink className="w-4 h-4" />View Live
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent('Check out my portfolio: ' + window.location.origin + '/portfolio/' + user.username)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors min-h-[44px]"
                style={{ color: '#25D366', borderColor: 'rgba(37,211,102,0.3)' }}
              >
                <MessageCircle className="w-4 h-4" />WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
          <TabsList className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] p-1 flex flex-nowrap w-max md:w-auto">
            {[
              { value: 'profile', icon: User, label: 'Profile' },
              { value: 'skills', icon: Code2, label: 'Skills' },
              { value: 'projects', icon: FolderGit2, label: 'Projects' },
              { value: 'milestones', icon: Award, label: 'Milestones' },
              { value: 'social', icon: Share2, label: 'Social' },
              { value: 'ai', icon: Bot, label: 'AI Edit' },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                data-testid={`portfolio-tab-${value}`}
                className="data-[state=active]:bg-[var(--ag-violet)] data-[state=active]:text-white whitespace-nowrap press-scale min-h-[44px]"
              >
                <Icon className="w-4 h-4 mr-2" />{label}
              </TabsTrigger>
            ))}
            <TabsTrigger value="suggestions" data-testid="portfolio-tab-suggestions" className="data-[state=active]:bg-[var(--ag-violet)] data-[state=active]:text-white whitespace-nowrap press-scale min-h-[44px]">
              <Lightbulb className="w-4 h-4 mr-2" />Suggestions
              {suggestions.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-[var(--ag-nova)] text-white rounded-full">{suggestions.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="portfolio-tab-analytics" className="data-[state=active]:bg-[var(--ag-violet)] data-[state=active]:text-white whitespace-nowrap press-scale min-h-[44px]">
              <BarChart3 className="w-4 h-4 mr-2" />Analytics
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="portfolio-tab-preview" className="data-[state=active]:bg-[var(--ag-violet)] data-[state=active]:text-white whitespace-nowrap press-scale min-h-[44px]">
              <Eye className="w-4 h-4 mr-2" />Preview
            </TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-[var(--ag-violet)] data-[state=active]:text-white whitespace-nowrap press-scale relative min-h-[44px]">
              Messages
              {contacts.length > 0 && (
                <span className="ml-1.5 bg-[var(--ag-nova)] text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                  {contacts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="space-y-6">
          <ProfileTab
            headline={headline} setHeadline={setHeadline}
            about={about} setAbout={setAbout}
            metaDescription={metaDescription} setMetaDescription={setMetaDescription}
            avatar={avatar} setAvatar={setAvatar}
            layout={layout} setLayout={setLayout}
            skills={skills}
            showMessage={showMessage}
          />
        </TabsContent>

        <TabsContent value="skills" className="space-y-6">
          <SkillsTab
            skills={skills} setSkills={setSkills}
            headline={headline} about={about}
            showMessage={showMessage}
          />
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <ProjectsTab projects={projects} setProjects={setProjects} />
        </TabsContent>

        <TabsContent value="milestones" className="space-y-6">
          <MilestonesTab milestones={milestones} setMilestones={setMilestones} />
        </TabsContent>

        <TabsContent value="social" className="space-y-6">
          <SocialTab social={social} setSocial={setSocial} />
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <AITab onAiEdit={applyPortfolioData} showMessage={showMessage} />
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-6">
          <SuggestionsTab
            suggestions={suggestions} setSuggestions={setSuggestions}
            loadingSuggestions={loadingSuggestions}
            onSuggestionApplied={applyPortfolioData}
            showMessage={showMessage}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsTab portfolioStats={portfolioStats} showMessage={showMessage} />
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <PreviewTab username={user?.username} />
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <MessagesTab contacts={contacts} />
        </TabsContent>
      </Tabs>
    </div>
    </PageWrapper>
    </PageShell>
    </DashboardPageWrapper>
  );
}
