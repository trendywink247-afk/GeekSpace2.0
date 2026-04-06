import { useState } from 'react';
import { Code2, Plus, X, Loader2, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/agentin';
import { portfolioService } from '@/services/api';

interface SkillsTabProps {
  skills: string[];
  setSkills: (v: string[]) => void;
  headline: string;
  about: string;
  showMessage: (type: 'success' | 'error', text: string) => void;
}

export function SkillsTab({ skills, setSkills, headline, about, showMessage }: SkillsTabProps) {
  const [newSkill, setNewSkill] = useState('');
  const [generatingField, setGeneratingField] = useState<string | null>(null);

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleGenerateSkills = async () => {
    setGeneratingField('skills');
    try {
      const { data } = await portfolioService.generateField('skills', `${headline}\n${about}`);
      const newSkills = data.generated.split(',').map((s: string) => s.trim()).filter(Boolean);
      const uniqueSkills = [...new Set([...skills, ...newSkills])];
      setSkills(uniqueSkills);
      showMessage('success', `Added ${newSkills.length} skills (5 credits used)`);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      if (error.response?.status === 402) {
        showMessage('error', 'Insufficient credits — upgrade your plan');
      } else {
        showMessage('error', error.response?.data?.error || 'Generation failed');
      }
    } finally {
      setGeneratingField(null);
    }
  };

  return (
    <SectionCard title="Skills" subtitle="Add technologies and skills you want to showcase">
      <div className="flex items-center justify-end mb-4">
        <Button
          onClick={handleGenerateSkills}
          disabled={generatingField === 'skills' || !headline}
          variant="outline"
          className="border-[var(--ag-border-default)] hover:border-[var(--ag-border-glow)]"
        >
          {generatingField === 'skills' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Wand2 className="w-4 h-4 mr-2" />
          )}
          Generate
        </Button>
      </div>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
            placeholder="e.g. TypeScript, React, Docker..."
            className="bg-[var(--ag-bg-base)] border-[var(--ag-border-default)] text-[var(--ag-text-primary)] focus:border-[var(--ag-violet)]"
          />
          <Button
            onClick={addSkill}
            disabled={!newSkill.trim()}
            className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 text-white border-0 min-h-[44px] press-scale shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Plus className="w-4 h-4 mr-2" />Add
          </Button>
        </div>

        {skills.length === 0 ? (
          <div className="text-center py-8">
            <Code2 className="w-10 h-10 text-[var(--ag-nova)]/30 mx-auto mb-3" />
            <p className="text-[var(--ag-text-secondary)]">No skills added yet</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <button
                key={skill}
                onClick={() => removeSkill(skill)}
                className="group flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-full bg-[var(--ag-nova)]/10 border border-[var(--ag-nova)]/30 text-[var(--ag-nova)] hover:bg-[var(--ag-pink)]/10 hover:border-[var(--ag-pink)]/30 hover:text-[var(--ag-pink)] transition-all press-scale"
              >
                {skill}
                <X className="w-3 h-3 opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-60 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
