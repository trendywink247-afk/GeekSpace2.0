import { CheckCircle2, XCircle, Briefcase, Palette, User, Code } from 'lucide-react';

interface ActionResultCardProps {
  tool: string;
  success: boolean;
  message: string;
}

function getToolIcon(tool: string) {
  switch (tool) {
    case 'generate_code':
      return Code;
    case 'portfolio_add_project':
    case 'portfolio_update_skills':
      return Briefcase;
    case 'portfolio_update_bio':
      return User;
    case 'portfolio_update_theme':
      return Palette;
    case 'portfolio_remove_project':
      return XCircle;
    default:
      return Code;
  }
}

export function ActionResultCard({ tool, success, message }: ActionResultCardProps) {
  const ToolIcon = getToolIcon(tool);

  const colorClasses = success
    ? 'border-[#61FF7B]/30 bg-[#61FF7B]/5 text-[#61FF7B]'
    : 'border-[#FF6161]/30 bg-[#FF6161]/5 text-[#FF6161]';

  return (
    <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${colorClasses}`}>
      {success ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 shrink-0" />
      )}
      <ToolIcon className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
