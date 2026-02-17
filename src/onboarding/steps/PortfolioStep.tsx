import { Layout } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface PortfolioStepProps {
  skills: string[];
  headline: string;
  about: string;
  onSkillsChange: (skills: string[]) => void;
  onHeadlineChange: (headline: string) => void;
  onAboutChange: (about: string) => void;
  onSkip: () => void;
}

export function PortfolioStep({ skills, headline, about, onSkillsChange, onHeadlineChange, onAboutChange, onSkip }: PortfolioStepProps) {
  const handleSkillsInput = (value: string) => {
    const parsed = value.split(',').map((s) => s.trim()).filter(Boolean);
    onSkillsChange(parsed);
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
      <div>
        <label className="text-sm text-[#A7ACB8] mb-2 block">Portfolio Headline</label>
        <Input
          value={headline}
          onChange={(e) => onHeadlineChange(e.target.value)}
          placeholder="Full-stack Developer & AI Enthusiast"
          className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
        />
      </div>
      <div>
        <label className="text-sm text-[#A7ACB8] mb-2 block">Skills (comma-separated)</label>
        <Input
          value={skills.join(', ')}
          onChange={(e) => handleSkillsInput(e.target.value)}
          placeholder="React, TypeScript, Python, Docker"
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
          placeholder="Tell visitors about your work, interests, and what you're building..."
          className="w-full p-3 rounded-xl bg-[#05050A] border border-[#7B61FF]/30 text-[#F4F6FF] min-h-[100px] resize-none focus:outline-none focus:border-[#7B61FF] placeholder:text-[#A7ACB8]/50"
        />
      </div>
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[#A7ACB8] hover:text-[#7B61FF] transition-colors"
        >
          I'll do this later
        </button>
      </div>
    </div>
  );
}
