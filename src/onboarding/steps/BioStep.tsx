import { FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';

const TAG_OPTIONS = [
  'AI Engineer', 'No-Code Automation', 'Designer', 'Founder',
  'Data Scientist', 'DevOps', 'Content Creator', 'Marketer',
];

interface BioStepProps {
  bio: string;
  headline: string;
  tags: string[];
  onBioChange: (bio: string) => void;
  onHeadlineChange: (headline: string) => void;
  onTagsChange: (tags: string[]) => void;
}

export function BioStep({ bio, headline, tags, onBioChange, onHeadlineChange, onTagsChange }: BioStepProps) {
  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      onTagsChange(tags.filter((t) => t !== tag));
    } else if (tags.length < 3) {
      onTagsChange([...tags, tag]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-[#7B61FF]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Bio & Headline
        </h2>
      </div>
      <p className="text-[#A7ACB8] text-sm">
        Tell the world a bit about yourself. This shows on your public portfolio.
      </p>
      <div>
        <label className="text-sm text-[#A7ACB8] mb-2 block">Headline / Tagline</label>
        <Input
          value={headline}
          onChange={(e) => onHeadlineChange(e.target.value)}
          placeholder="Full-stack Developer & AI Enthusiast"
          className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
        />
      </div>
      <div>
        <label className="text-sm text-[#A7ACB8] mb-2 block">Short Bio (min 10 characters)</label>
        <textarea
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          placeholder="What do you do? What are you into?"
          className="w-full p-3 rounded-xl bg-[#05050A] border border-[#7B61FF]/30 text-[#F4F6FF] min-h-[100px] resize-none focus:outline-none focus:border-[#7B61FF] placeholder:text-[#A7ACB8]/50"
        />
        {bio.length > 0 && bio.length < 10 && (
          <p className="text-xs text-[#FF6161] mt-1">Bio must be at least 10 characters</p>
        )}
      </div>
      <div>
        <label className="text-sm text-[#A7ACB8] mb-2 block">Tags (select up to 3)</label>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                tags.includes(tag)
                  ? 'bg-[#7B61FF]/20 border border-[#7B61FF] text-[#7B61FF]'
                  : 'bg-[#05050A] border border-[#7B61FF]/20 text-[#A7ACB8] hover:border-[#7B61FF]/50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
