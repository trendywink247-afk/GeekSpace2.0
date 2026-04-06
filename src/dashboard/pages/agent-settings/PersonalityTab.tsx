import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Globe, Brain, Shield, Users, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GlassCard, SliderRow } from './shared';
import {
  AGENTS,
  MODELS,
  AGENT_ASSIGNMENTS,
  AUTONOMY_LEVELS,
  TONE_LABELS,
  VERBOSITY_LABELS,
  CREATIVITY_LABELS,
  HUMOR_LABELS,
  EMPATHY_LABELS,
  containerVariants,
  itemVariants,
} from './constants';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PersonalityTabProps {
  agentName: string;
  setAgentName: (v: string) => void;
  tone: number[];
  setTone: (v: number[]) => void;
  verbosity: number[];
  setVerbosity: (v: number[]) => void;
  creativity: number[];
  setCreativity: (v: number[]) => void;
  humor: number[];
  setHumor: (v: number[]) => void;
  empathy: number[];
  setEmpathy: (v: number[]) => void;
  language: string;
  setLanguage: (v: string) => void;
  autonomyLevel: string;
  setAutonomyLevel: (v: string) => void;
  customInstructions: string;
  setCustomInstructions: (v: string) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  isSaving: boolean;
  currentAgentName: string;
  onDirty: () => void;
  onSave: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PersonalityTab({
  agentName,
  setAgentName,
  tone,
  setTone,
  verbosity,
  setVerbosity,
  creativity,
  setCreativity,
  humor,
  setHumor,
  empathy,
  setEmpathy,
  language,
  setLanguage,
  autonomyLevel,
  setAutonomyLevel,
  customInstructions,
  setCustomInstructions,
  selectedModel,
  setSelectedModel,
  isSaving,
  currentAgentName,
  onDirty,
  onSave,
}: PersonalityTabProps) {
  // Derived step values for slider labels
  const toneStep = Math.round(tone[0] / 25);
  const verbosityStep = Math.round(verbosity[0] / 25);
  const creativityStep = Math.round(creativity[0] / 25);
  const humorStep = Math.round(humor[0] / 25);
  const empathyStep = Math.round(empathy[0] / 25);
  const instructionsLength = customInstructions.length;

  return (
    <motion.div
      key="personality"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mt-5 space-y-4"
    >
      {/* Agent Name */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div className="p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading">
                Agent Name
              </h2>
              <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                This name is used in conversations and greetings.
              </p>
            </div>
            <Input
              value={agentName}
              onChange={(e) => { onDirty(); setAgentName(e.target.value); }}
              className="max-w-sm min-h-[44px] rounded-xl text-[var(--ag-text-primary)] focus:ring-[var(--ag-violet)]/20"
              style={{
                background: 'rgba(255,255,255,0.04)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
                border: 'none',
              }}
              placeholder="What should your agent be called?"
              maxLength={30}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Primary Model */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                  Primary Model
                </h2>
                <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                  Choose the LLM that powers your agent's responses.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {MODELS.map((m) => {
                const isActive = selectedModel === m.id;
                return (
                  <motion.button
                    key={m.id}
                    onClick={() => { onDirty(); setSelectedModel(m.id); }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                    style={{
                      color: isActive ? 'var(--ag-violet)' : 'var(--ag-text-secondary)',
                      background: isActive ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                      boxShadow: isActive
                        ? '0 0 0 1px var(--ag-border-active), var(--ag-glow-sm)'
                        : '0 0 0 1px rgba(255,255,255,0.07)',
                      transition: 'all 200ms ease',
                    }}
                  >
                    {m.label}
                    {m.tier === 'pro' && (
                      <span
                        className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{
                          background: 'rgba(139,92,246,0.15)',
                          color: 'var(--ag-violet)',
                          boxShadow: '0 0 0 1px rgba(139,92,246,0.25)',
                        }}
                      >
                        PRO
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Personality Sliders */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div className="p-5">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                  Personality Tuning
                </h2>
                <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                  Adjust how your agent communicates.
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
              <SliderRow
                label="Creativity"
                value={creativity}
                onChange={(v) => { onDirty(); setCreativity(v); }}
                valueBadge={CREATIVITY_LABELS[creativityStep]}
                leftLabel="Factual"
                rightLabel="Exploratory"
              />
              <SliderRow
                label="Tone"
                value={tone}
                onChange={(v) => { onDirty(); setTone(v); }}
                valueBadge={TONE_LABELS[toneStep]}
                leftLabel="Casual"
                rightLabel="Formal"
              />
              <SliderRow
                label="Verbosity"
                value={verbosity}
                onChange={(v) => { onDirty(); setVerbosity(v); }}
                valueBadge={VERBOSITY_LABELS[verbosityStep]}
                leftLabel="Terse"
                rightLabel="Detailed"
              />
              <SliderRow
                label="Humor"
                value={humor}
                onChange={(v) => { onDirty(); setHumor(v); }}
                valueBadge={HUMOR_LABELS[humorStep]}
                leftLabel="Serious"
                rightLabel="Humorous"
              />
              <div className="md:col-span-2 md:max-w-[calc(50%-1rem)]">
                <SliderRow
                  label="Empathy"
                  value={empathy}
                  onChange={(v) => { onDirty(); setEmpathy(v); }}
                  valueBadge={EMPATHY_LABELS[empathyStep]}
                  leftLabel="Direct"
                  rightLabel="Empathetic"
                />
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Language Preference */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                  Language Preference
                </h2>
                <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                  Your agent will respond primarily in this language.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'english', label: 'English' },
                { id: 'hinglish', label: 'Hinglish' },
                { id: 'hindi', label: 'Hindi' },
              ].map((lang) => {
                const isActive = language === lang.id;
                return (
                  <motion.button
                    key={lang.id}
                    onClick={() => setLanguage(lang.id)}
                    whileTap={{ scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                    style={{
                      color: isActive ? 'var(--ag-violet)' : 'var(--ag-text-secondary)',
                      background: isActive ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
                      boxShadow: isActive
                        ? '0 0 0 1px var(--ag-border-active)'
                        : '0 0 0 1px rgba(255,255,255,0.07)',
                      transition: 'all 200ms ease',
                    }}
                  >
                    {lang.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Custom Instructions */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                  Custom Instructions
                </h2>
                <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                  These instructions guide your agent's behavior across all conversations.
                </p>
              </div>
            </div>
            <div className="relative">
              <Textarea
                value={customInstructions}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    onDirty();
                    setCustomInstructions(e.target.value);
                  }
                }}
                className="min-h-[120px] rounded-xl text-[var(--ag-text-primary)] resize-none pr-14 focus:ring-[var(--ag-violet)]/20"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.07)',
                  border: 'none',
                }}
                placeholder="Tell your agent how to behave. E.g. 'Always respond with bullet points' or 'Be encouraging and use emojis'..."
                maxLength={500}
              />
              <span
                className="absolute bottom-3 right-3 text-xs font-mono"
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: instructionsLength > 450 ? 'var(--ag-pink)' : 'var(--ag-text-muted)',
                }}
              >
                {instructionsLength}/500
              </span>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Autonomy Level */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                  Autonomy Level
                </h2>
                <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                  How much freedom does {currentAgentName} have to act on your behalf?
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              {AUTONOMY_LEVELS.map((level) => {
                const isActive = autonomyLevel === level.id;
                return (
                  <motion.button
                    key={level.id}
                    onClick={() => { onDirty(); setAutonomyLevel(level.id); }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="w-full flex items-start gap-3 p-4 min-h-[44px] rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                    style={{
                      background: isActive ? 'rgba(167,139,250,0.07)' : 'rgba(255,255,255,0.02)',
                      boxShadow: isActive
                        ? '0 0 0 1px var(--ag-border-active)'
                        : '0 0 0 1px rgba(255,255,255,0.06)',
                      transition: 'all 200ms ease',
                    }}
                  >
                    <div
                      className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        boxShadow: isActive
                          ? '0 0 0 2px var(--ag-cyan)'
                          : '0 0 0 2px rgba(156,163,175,0.4)',
                        transition: 'box-shadow 200ms ease',
                      }}
                    >
                      <AnimatePresence initial={false}>
                        {isActive && (
                          <motion.div
                            key="dot"
                            initial={{ scale: 0.25, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.25, opacity: 0 }}
                            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: 'var(--ag-cyan)' }}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <level.icon
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: isActive ? 'var(--ag-cyan)' : 'var(--ag-text-muted)' }}
                        />
                        <span
                          className="text-sm font-semibold"
                          style={{
                            color: isActive ? 'var(--ag-text-primary)' : 'var(--ag-text-secondary)',
                          }}
                        >
                          {level.label}
                        </span>
                      </div>
                      <p
                        className="text-xs text-[var(--ag-text-secondary)] mt-1 leading-relaxed"
                        style={{ textWrap: 'pretty' } as React.CSSProperties}
                      >
                        {level.description}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Agent Assignments */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                  Agent Assignments
                </h2>
                <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                  Each agent specializes in different areas.
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              {AGENTS.map((a) => {
                const features = AGENT_ASSIGNMENTS[a.id] || [];
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3.5 rounded-xl"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: a.color,
                          color: 'var(--ag-bg-base)',
                          WebkitFontSmoothing: 'antialiased',
                        }}
                      >
                        {a.name[0]}
                      </div>
                      <span className="text-sm font-medium text-[var(--ag-text-primary)]">
                        {a.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {features.map((f) => (
                        <span
                          key={f}
                          className="text-xs px-2.5 py-1 rounded-lg text-[var(--ag-text-secondary)]"
                          style={{
                            background: 'rgba(139,92,246,0.06)',
                            boxShadow: '0 0 0 1px rgba(139,92,246,0.12)',
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Save Button */}
      <motion.div variants={itemVariants} className="flex justify-end pb-2">
        <motion.div whileTap={{ scale: 0.96 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
          <Button
            size="lg"
            onClick={onSave}
            disabled={isSaving}
            className="min-h-[44px] rounded-xl font-semibold px-8 text-white focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
            style={{
              background: 'linear-gradient(135deg, var(--ag-violet) 0%, var(--ag-amber) 100%)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 4px 16px rgba(139,92,246,0.35)',
              transition: 'opacity 200ms ease, box-shadow 200ms ease',
            }}
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
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
