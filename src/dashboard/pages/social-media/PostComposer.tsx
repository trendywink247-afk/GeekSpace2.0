// social-media/PostComposer.tsx
// Self-contained Quick Post Composer — AI generation, thread preview, hashtags, copy
import { useState, useCallback, useMemo } from 'react';
import { SectionCard } from '@/components/agentin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Wand2, Sparkles, Loader2, AlertCircle,
  Scissors, Hash, Eye, Heart, MessageCircle, Share2,
  Check, Copy,
} from 'lucide-react';
import { agentService } from '@/services/api';
import {
  PLATFORMS, PlatformIcon, TonePills, splitIntoThread,
} from './helpers';
import type { Tone, Platform } from './helpers';
import { PlatformBadges, CharacterCounter } from './PlatformSelector';

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
      className={`transition-[transform,background-color,color,box-shadow] duration-200 active:scale-[0.96] min-h-[44px] ${
        copied
          ? 'bg-[var(--ag-success)]/20 text-[var(--ag-success)] border border-[var(--ag-success)]/40'
          : 'bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-gold)] text-white border-0 hover:opacity-90'
      } ${className}`}
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 mr-1" /> Copied!
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 mr-1" /> {label}
        </>
      )}
    </Button>
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
    <div className="mt-3 p-3 rounded-lg bg-[var(--ag-bg-deep)] border border-[var(--ag-border-subtle)]">
      <div className="flex items-center gap-1.5 mb-2">
        <Hash className="w-3.5 h-3.5 text-[var(--ag-violet)]" />
        <span className="text-xs font-medium text-[var(--ag-text-muted)]">Suggested Hashtags</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hashtags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] text-xs"
          >
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
        <span className="text-xs font-medium text-[var(--ag-text-muted)]">
          Preview on {info.label}
        </span>
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
            <PlatformIcon platform={platform} className="w-4 h-4" style={{ color: info.color }} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--ag-text-primary)]">Your Brand</span>
            <span className="text-[10px] text-[var(--ag-text-muted)] block">
              {platform === 'twitter'
                ? '@yourbrand'
                : platform === 'linkedin'
                  ? 'Your Brand Inc.'
                  : '@yourbrand'}
            </span>
          </div>
        </div>
        {/* Body text */}
        <p className="text-sm text-[var(--ag-text-primary)] whitespace-pre-wrap leading-relaxed">
          {truncated}
        </p>
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

function ThreadComposer({
  text,
  onCopy,
}: {
  text: string;
  onCopy: (content: string) => void;
}) {
  const tweets = useMemo(() => splitIntoThread(text), [text]);

  if (tweets.length <= 1) return null;

  const numbered = tweets.map((t, i) => `${i + 1}/ ${t}`);
  const fullThread = numbered.join('\n\n');

  return (
    <div className="mt-3 p-3 rounded-lg bg-[var(--ag-bg-deep)] border border-[var(--ag-border-subtle)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Scissors className="w-3.5 h-3.5 text-[var(--ag-violet)]" />
          <span className="text-xs font-medium text-[var(--ag-text-muted)]">
            Thread Preview ({tweets.length} tweets)
          </span>
        </div>
        <CopyButton text={fullThread} label="Copy Thread" onCopy={onCopy} />
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
                  style={{
                    color: isOver ? '#FF6161' : bodyLen > 250 ? '#FFB800' : '#9CA3AF',
                  }}
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

// ---- Post Composer ----

export interface PostComposerProps {
  /** Show a Cancel button (e.g. when opened from empty state) */
  showCancel?: boolean;
  /** Called when Cancel is clicked — parent controls visibility */
  onHide?: () => void;
}

export function PostComposer({ showCancel, onHide }: PostComposerProps) {
  const [composerText, setComposerText] = useState('');
  const [composerTone, setComposerTone] = useState<Tone>('informative');
  const [composerPlatform, setComposerPlatform] = useState<Platform>('twitter');
  const [composerTopic, setComposerTopic] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  const handleHide = useCallback(() => {
    setComposerText('');
    setComposerTopic('');
    setAiError('');
    onHide?.();
  }, [onHide]);

  const formatForPlatform = useCallback(
    (text: string, platform: Platform): string => {
      if (platform === 'linkedin') {
        return text.trim().replace(/\n{3,}/g, '\n\n');
      }
      return text.trim();
    },
    []
  );

  const handleAiGenerate = async () => {
    if (!composerTopic.trim()) return;
    setAiGenerating(true);
    setAiError('');
    try {
      const platformLabel =
        PLATFORMS.find((p) => p.value === composerPlatform)?.label ?? composerPlatform;
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

  const currentPlatformLabel =
    PLATFORMS.find((p) => p.value === composerPlatform)?.label ?? composerPlatform;

  return (
    <SectionCard className="border-[var(--ag-violet)]/20 bg-[var(--ag-bg-surface)] backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-3">
        <Wand2 className="w-4 h-4 text-[var(--ag-violet)]" />
        <h2 className="text-sm font-semibold font-heading text-[var(--ag-text-primary)]">
          Quick Post Composer
        </h2>
      </div>
      <div className="space-y-3">
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
        <div className="p-3 rounded-lg bg-[var(--ag-bg-deep)] border border-[var(--ag-border-subtle)] space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6B9D]" />
            <span className="text-xs font-medium text-[var(--ag-text-muted)]">AI Generate</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={composerTopic}
              onChange={(e) => setComposerTopic(e.target.value)}
              placeholder="Describe your topic (e.g., AI productivity tips for developers)"
              className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && composerTopic.trim() && !aiGenerating)
                  handleAiGenerate();
              }}
              disabled={aiGenerating}
            />
            <Button
              size="sm"
              onClick={handleAiGenerate}
              disabled={aiGenerating || !composerTopic.trim()}
              className="bg-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/90 whitespace-nowrap min-h-[44px] transition-[transform,background-color] active:scale-[0.96]"
            >
              {aiGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1" /> Generate Post
                </>
              )}
            </Button>
          </div>
          {aiError && (
            <p className="text-xs text-[#FF6161] flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {aiError}
            </p>
          )}
        </div>

        {/* Textarea */}
        <div>
          <Textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder={`Write your ${composerTone} post for ${currentPlatformLabel}, or use AI Generate above...`}
            className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)] text-sm min-h-[100px] focus:border-[#FF6B9D]/30"
            disabled={aiGenerating}
          />
          <CharacterCounter count={composerText.length} platform={composerPlatform} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <CopyButton
            text={formatForPlatform(composerText, composerPlatform)}
            label={`Copy for ${currentPlatformLabel}`}
          />
          {composerPlatform === 'twitter' && composerText.length > 280 && (
            <Badge variant="outline" className="text-xs text-[#FFB800] border-[#FFB800]/30 py-1">
              <Scissors className="w-3 h-3 mr-1" /> Thread mode active
            </Badge>
          )}
          {showCancel && (
            <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={handleHide}>
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
      </div>
    </SectionCard>
  );
}
