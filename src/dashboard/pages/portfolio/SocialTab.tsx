import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/agentin';
import type { Portfolio } from '@/types';

interface SocialTabProps {
  social: Portfolio['social'];
  setSocial: (v: Portfolio['social']) => void;
}

const SOCIAL_FIELDS: Array<{ key: keyof NonNullable<Portfolio['social']>; label: string; placeholder: string }> = [
  { key: 'github', label: 'GitHub', placeholder: 'github.com/username or https://github.com/username' },
  { key: 'twitter', label: 'Twitter / X', placeholder: 'x.com/username or https://x.com/username' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/username' },
  { key: 'website', label: 'Website', placeholder: 'yoursite.com or https://yoursite.com' },
  { key: 'email', label: 'Email', placeholder: 'you@example.com' },
];

export function SocialTab({ social, setSocial }: SocialTabProps) {
  return (
    <SectionCard title="Social Links" subtitle="Connect your online presence — all fields are optional">
      <div className="space-y-4">
        {SOCIAL_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="text-sm text-[var(--ag-text-secondary)] mb-2 block">{field.label}</label>
            <Input
              value={social?.[field.key] || ''}
              onChange={(e) => setSocial({ ...social, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
            />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
