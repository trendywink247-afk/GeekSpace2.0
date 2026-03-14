import { useState } from 'react';
import { Braces, Cpu } from 'lucide-react';
import { JsonFormatterPage } from './tools/JsonFormatterPage';

type ToolTab = 'json';

interface Tab {
  id: ToolTab;
  label: string;
  icon: typeof Braces;
}

const TABS: Tab[] = [
  { id: 'json', label: 'JSON', icon: Braces },
];

export function AISpecialistPage() {
  const [activeTab, setActiveTab] = useState<ToolTab>('json');

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <div className="w-9 h-9 rounded-xl bg-[#7B61FF]/20 flex items-center justify-center flex-shrink-0">
          <Cpu className="w-4.5 h-4.5 text-[#7B61FF]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#E8E8F0]">AI Specialist Tools</h1>
          <p className="text-sm text-[#9CA3AF]">Developer utilities for working with AI</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="overflow-x-auto scrollbar-hide w-full px-4">
        <div className="flex gap-1 border-b border-[#2A2A3A] w-max min-w-full">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap flex-shrink-0 border-b-2 transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 ${
                  active
                    ? 'border-[#7B61FF] text-[#E8E8F0]'
                    : 'border-transparent text-[#9CA3AF] hover:text-[#A0A0B0]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'json' && <JsonFormatterPage />}
      </div>
    </div>
  );
}
