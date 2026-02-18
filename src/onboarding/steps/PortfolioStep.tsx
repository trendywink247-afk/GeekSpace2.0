import { useState } from 'react';
import { Layout, Sparkles, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { agentService } from '@/services/api';

interface PortfolioStepProps {
  skills: string[];
  headline: string;
  about: string;
  tags: string[];
  name: string;
  onSkillsChange: (skills: string[]) => void;
  onHeadlineChange: (headline: string) => void;
  onAboutChange: (about: string) => void;
  onSkip: () => void;
}

export function PortfolioStep({ skills, headline, about, tags, name, onSkillsChange, onHeadlineChange, onAboutChange, onSkip }: PortfolioStepProps) {
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicDone, setMagicDone] = useState(false);

  const handleSkillsInput = (value: string) => {
    const parsed = value.split(',').map((s) => s.trim()).filter(Boolean);
    onSkillsChange(parsed);
  };

  const handleMagic = async () => {
    if (tags.length === 0) return;
    setMagicLoading(true);
    try {
      const { data } = await agentService.generateContent('portfolio-batch', tags, name);
      const headline = (data.parsed?.headline as string) || '';
      const about = (data.parsed?.about as string) || '';
      const skills = (data.parsed?.skills as string[]) || [];
      onHeadlineChange(headline);
      onAboutChange(about);
      if (skills.length > 0) onSkillsChange(skills);
      setMagicDone(true);
    } catch {
      // silently fail
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Layout className="w-6 h-6 text-[#7B61FF]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Portfolio Setup
        </h2>
      </div>
      <p className="text-[#A7ACB8] text-sm">
        Set up your public portfolio. This is what visitors and potential collaborators see.
      </p>

      {/* Magic button */}
      {tags.length > 0 && !magicDone && (
        <button
          type="button"
          onClick={handleMagic}
          disabled={magicLoading}
          className="w-full py-3 min-h-[44px] rounded-xl border-2 border-dashed border-[#7B61FF]/40 text-[#7B61FF] hover:bg-[#7B61FF]/10 hover:border-[#7B61FF] transition-all flex items-center justify-center gap-2 text-sm font-medium"
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
        <label className="text-sm text-[#A7ACB8] mb-2 block">Portfolio Headline</label>
        <Input
          value={headline}
          onChange={(e) => onHeadlineChange(e.target.value)}
          placeholder="Developer & Builder"
          className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
        />
      </div>
      <div>
        <label className="text-sm text-[#A7ACB8] mb-2 block">Skills (comma-separated)</label>
        <Input
          value={skills.join(', ')}
          onChange={(e) => handleSkillsInput(e.target.value)}
          placeholder="React, TypeScript, Python"
          className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
        />
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {skills.map((skill) => (
              <span key={skill} className="px-2 py-1 text-xs rounded-full bg-[#7B61FF]/15 text-[#7B61FF] border border-[#7B61FF]/20">
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="text-sm text-[#A7ACB8] mb-2 block">About</label>
        <textarea
          value={about}
          onChange={(e) => onAboutChange(e.target.value)}
          placeholder="Building cool things"
          className="w-full p-3 rounded-xl bg-[#05050A] border border-[#7B61FF]/30 text-[#F4F6FF] min-h-[100px] resize-none focus:outline-none focus:border-[#7B61FF] placeholder:text-[#A7ACB8]/50"
        />
      </div>

      {magicDone && (
        <button
          type="button"
          onClick={() => { setMagicDone(false); }}
          className="text-xs text-[#A7ACB8] hover:text-[#7B61FF] transition-colors flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          Try the magic trick again
        </button>
      )}

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[#A7ACB8] hover:text-[#7B61FF] transition-colors min-h-[44px] px-4"
        >
          I'll do this later
        </button>
      </div>
    </div>
  );
}
