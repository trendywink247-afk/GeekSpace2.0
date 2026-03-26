// @deprecated — DEAD CODE confirmed by Sprint 1 audit 2026-03-26. Not imported in DashboardApp.tsx. Safe to delete.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Loader2, CheckCircle2, XCircle, Package } from 'lucide-react';
import { SkillCard } from '@/components/skills/SkillCard';
import { SkillDetailModal } from '@/components/skills/SkillDetailModal';
import { skillService } from '@/services/api';
import type { Skill, UserSkill } from '@/components/skills/SkillCard';

// ----- Categories ------------------------------------------------

const CATEGORIES = [
  { id: 'all', label: 'All Skills', icon: '\u26A1' },
  { id: 'india-business', label: 'India Business', icon: '\uD83C\uDDEE\uD83C\uDDF3' },
  { id: 'productivity', label: 'Productivity', icon: '\uD83D\uDCCE' },
  { id: 'communication', label: 'Communication', icon: '\uD83D\uDCAC' },
  { id: 'development', label: 'Development', icon: '\uD83D\uDCBB' },
  { id: 'data-analysis', label: 'Data & Analytics', icon: '\uD83D\uDCCA' },
  { id: 'research', label: 'Research', icon: '\uD83D\uDD2C' },
  { id: 'finance', label: 'Finance', icon: '\uD83D\uDCB0' },
  { id: 'security', label: 'Security', icon: '\uD83D\uDD12' },
  { id: 'automation', label: 'Automation', icon: '\u26A1' },
  { id: 'creative', label: 'Creative', icon: '\uD83C\uDFA8' },
];

// ----- Toast helper -----------------------------------------------

interface Toast {
  message: string;
  type: 'success' | 'error';
}

// ----- Component ---------------------------------------------------

export function SkillsPage() {
  const [catalog, setCatalog] = useState<Skill[]>([]);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showMySkills, setShowMySkills] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, []);

  // ----- Fetch data -----------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [catalogRes, userRes] = await Promise.all([
        skillService.getCatalog(),
        skillService.getUserSkills(),
      ]);
      const cd = catalogRes.data as unknown as { skills?: Skill[] } & Skill[];
      setCatalog(cd.skills ?? (Array.isArray(cd) ? cd : []));
      const ud = userRes.data as unknown as { skills?: UserSkill[] } & UserSkill[];
      setUserSkills(ud.skills ?? (Array.isArray(ud) ? ud : []));
    } catch {
      showToast('Failed to load skills', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ----- User skill lookup ----------------------------------------

  const userSkillMap = useMemo(() => {
    const map = new Map<string, UserSkill>();
    for (const us of userSkills) map.set(us.skillId, us);
    return map;
  }, [userSkills]);

  // ----- Filtering ------------------------------------------------

  const filtered = useMemo(() => {
    let items = catalog;

    if (showMySkills) {
      items = items.filter((s) => userSkillMap.has(s.id));
    }

    if (activeCategory !== 'all') {
      items = items.filter((s) => s.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return items;
  }, [catalog, userSkillMap, showMySkills, activeCategory, search]);

  // ----- Actions --------------------------------------------------

  const handleInstall = useCallback(
    async (skillId: string) => {
      try {
        setActionLoading(skillId);
        const res = await skillService.install(skillId);
        const newSkill: UserSkill = (res.data as { userSkill?: UserSkill }).userSkill ?? {
          skillId,
          enabled: true,
          agentOverrides: {},
          installedAt: new Date().toISOString(),
        };
        setUserSkills((prev) => [...prev, newSkill]);
        showToast('Skill installed', 'success');
      } catch {
        showToast('Failed to install skill', 'error');
      } finally {
        setActionLoading(null);
      }
    },
    [showToast]
  );

  const handleUninstall = useCallback(
    async (skillId: string) => {
      try {
        setActionLoading(skillId);
        await skillService.uninstall(skillId);
        setUserSkills((prev) => prev.filter((s) => s.skillId !== skillId));
        setSelectedSkill(null);
        showToast('Skill uninstalled', 'success');
      } catch {
        showToast('Failed to uninstall skill', 'error');
      } finally {
        setActionLoading(null);
      }
    },
    [showToast]
  );

  const handleToggle = useCallback(
    async (skillId: string, enabled: boolean) => {
      try {
        await skillService.toggle(skillId, enabled);
        setUserSkills((prev) =>
          prev.map((s) => (s.skillId === skillId ? { ...s, enabled } : s))
        );
      } catch {
        showToast('Failed to toggle skill', 'error');
      }
    },
    [showToast]
  );

  const handleToggleAgent = useCallback(
    async (skillId: string, agentId: string, enabled: boolean) => {
      try {
        const existing = userSkillMap.get(skillId);
        const overrides = { ...(existing?.agentOverrides ?? {}), [agentId]: enabled };
        await skillService.updateAgents(skillId, overrides);
        setUserSkills((prev) =>
          prev.map((s) =>
            s.skillId === skillId ? { ...s, agentOverrides: overrides } : s
          )
        );
      } catch {
        showToast('Failed to update agent settings', 'error');
      }
    },
    [userSkillMap, showToast]
  );

  // ----- Stats ----------------------------------------------------

  const installedCount = userSkills.length;

  // ----- Loading state --------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#00F0FF] animate-spin" />
      </div>
    );
  }

  // ----- Render ---------------------------------------------------

  return (
    <div className="space-y-5 animate-in fade-in duration-500 pb-24 md:pb-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl backdrop-blur-sm border shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 ${
            toast.type === 'success'
              ? 'bg-[#0C0C18]/90 border-[#00FF88]/40 shadow-[#00FF88]/10'
              : 'bg-[#0C0C18]/90 border-[#FF6161]/40 shadow-[#FF6161]/10'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#00FF88] shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-[#FF6161] shrink-0" />
          )}
          <span className="text-sm text-[#E8E8F0] font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1
            className="text-3xl md:text-4xl font-bold mb-1"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Skill Store
          </h1>
          <p className="text-[#9CA3AF] text-sm">
            <span className="text-[#00F0FF] font-medium">{installedCount}</span> installed of{' '}
            {catalog.length} skills
          </p>
        </div>

        {/* Search + My Skills toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Search skills..."
              aria-label="Search skills"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-sm text-[#E8E8F0] placeholder:text-[#6B7280] outline-none focus:border-[#00F0FF]/40 transition-colors"
            />
          </div>

          <button
            type="button"
            aria-label="Show my installed skills"
            aria-pressed={showMySkills}
            onClick={() => setShowMySkills((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 h-10 rounded-lg border transition-colors whitespace-nowrap min-w-[44px] ${
              showMySkills
                ? 'bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF]'
                : 'bg-white/5 border-white/10 text-[#9CA3AF] hover:text-[#E8E8F0]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">My Skills</span>
          </button>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border whitespace-nowrap transition-colors duration-150 min-h-[36px] ${
              activeCategory === cat.id
                ? 'bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF]'
                : 'bg-white/5 border-white/10 text-[#9CA3AF] hover:text-[#E8E8F0] hover:bg-white/[0.07]'
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Skill grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-[#6B7280] mx-auto mb-3" />
          <p className="text-[#9CA3AF] text-sm">
            {search || activeCategory !== 'all' || showMySkills
              ? 'No skills match your filters'
              : 'No skills available yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => {
            const us = userSkillMap.get(skill.id);
            return (
              <SkillCard
                key={skill.id}
                skill={skill}
                installed={!!us}
                enabled={us?.enabled ?? false}
                loading={actionLoading === skill.id}
                onInstall={handleInstall}
                onToggle={handleToggle}
                onClick={setSelectedSkill}
              />
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <SkillDetailModal
        skill={selectedSkill}
        userSkill={selectedSkill ? userSkillMap.get(selectedSkill.id) ?? null : null}
        open={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        onToggleAgent={handleToggleAgent}
        actionLoading={actionLoading === selectedSkill?.id}
      />
    </div>
  );
}
