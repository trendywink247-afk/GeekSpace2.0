import { useState } from 'react';
import { FileText, Sparkles, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { agentService } from '@/services/api';

const TAG_OPTIONS = [
  'AI Engineer', 'No-Code Automation', 'Designer', 'Founder',
  'Data Scientist', 'DevOps', 'Content Creator', 'Marketer',
];

interface BioStepProps {
  bio: string;
  headline: string;
  tags: string[];
  name: string;
  onBioChange: (bio: string) => void;
  onHeadlineChange: (headline: string) => void;
  onTagsChange: (tags: string[]) => void;
}

export function BioStep({ bio, headline, tags, name, onBioChange, onHeadlineChange, onTagsChange }: BioStepProps) {
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicDone, setMagicDone] = useState(false);

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      onTagsChange(tags.filter((t) => t !== tag));
    } else if (tags.length < 3) {
      onTagsChange([...tags, tag]);
    }
  };

  const handleMagic = async () => {
    if (tags.length === 0) return;
    setMagicLoading(true);
    try {
      const { data } = await agentService.generateContent('bio-batch', tags, name);
      const headline = (data.parsed?.headline as string) || '';
      const bio = (data.parsed?.bio as string) || '';
      onHeadlineChange(headline);
      onBioChange(bio);
      setMagicDone(true);
    } catch {
      // silently fail — user can still type manually
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-[#00F0FF]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
          Bio & Headline
        </h2>
      </div>
      <p className="text-[#6B7280] text-sm">
        Tell the world a bit about yourself. This shows on your public portfolio.
      </p>

      {/* Tags first — needed for magic */}
      <div>
        <label className="text-sm text-[#9CA3AF] mb-2 block">Tags (select up to 3)</label>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-4 py-2 min-h-[44px] rounded-full text-sm transition-all focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 ${
                tags.includes(tag)
                  ? 'bg-[#00F0FF]/20 border border-[#00F0FF] text-[#00F0FF]'
                  : 'bg-[#06060B] border border-[#00F0FF]/20 text-[#6B7280] hover:border-[#00F0FF]/50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Magic button — only shows when tags selected */}
      {tags.length > 0 && !magicDone && (
        <button
          type="button"
          onClick={handleMagic}
          disabled={magicLoading}
          className="w-full py-3 min-h-[44px] rounded-xl border-2 border-dashed border-[#00F0FF]/40 text-[#00F0FF] hover:bg-[#00F0FF]/10 hover:border-[#00F0FF] transition-all flex items-center justify-center gap-2 text-sm font-medium"
        >
          {magicLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating magic...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Wanna see a magic trick?
            </>
          )}
        </button>
      )}

      <div>
        <label className="text-sm text-[#9CA3AF] mb-2 block">Headline / Tagline</label>
        <Input
          value={headline}
          onChange={(e) => onHeadlineChange(e.target.value)}
          placeholder="Developer & Builder"
          className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]"
        />
      </div>
      <div>
        <label className="text-sm text-[#9CA3AF] mb-2 block">Short Bio (min 10 characters)</label>
        <textarea
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          placeholder="What do you do? What are you into?"
          className="w-full p-3 rounded-xl bg-[#06060B] border border-[#00F0FF]/30 text-[#E8E8F0] text-base min-h-[100px] resize-none focus:outline-none focus:border-[#00F0FF] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 placeholder:text-[#6B7280]/50"
        />
        {bio.length > 0 && bio.length < 10 && (
          <p className="text-xs text-[#FF3366] mt-1" role="alert" aria-live="polite">Bio must be at least 10 characters</p>
        )}
      </div>

      {/* Regenerate option after magic was used */}
      {magicDone && (
        <button
          type="button"
          onClick={() => { setMagicDone(false); }}
          className="text-xs text-[#6B7280] hover:text-[#00F0FF] transition-colors flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          Try the magic trick again
        </button>
      )}
    </div>
  );
}
