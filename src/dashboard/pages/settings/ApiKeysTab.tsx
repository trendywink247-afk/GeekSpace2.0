import { Key, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ApiProvider } from '@/types';

export interface ApiKeyEntry {
  id: string;
  provider: ApiProvider;
  label: string;
  maskedKey: string;
}

interface ApiKeysTabProps {
  apiKeys: ApiKeyEntry[];
  setApiKeys: (keys: ApiKeyEntry[]) => void;
  newKeyProvider: ApiProvider;
  setNewKeyProvider: (p: ApiProvider) => void;
  newKeyValue: string;
  setNewKeyValue: (v: string) => void;
  showAddKey: boolean;
  setShowAddKey: (v: boolean) => void;
  rotatingKeyId: string | null;
  setRotatingKeyId: (id: string | null) => void;
  rotateValue: string;
  setRotateValue: (v: string) => void;
  isRotating: boolean;
  handleAddKey: () => void;
  handleRotateKey: (id: string) => void;
}

const PROVIDER_EMOJI: Record<string, string> = {
  openai: '🤖',
  anthropic: '🅰',
  qwen: '🇨🇳',
  openrouter: '🔀',
  custom: '⚙️',
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d4a574',
  qwen: '#6366f1',
  openrouter: '#ef4444',
  custom: '#A78BFA',
};

const PROVIDERS: ApiProvider[] = ['openai', 'anthropic', 'qwen', 'openrouter'];

export function ApiKeysTab({
  apiKeys,
  setApiKeys,
  newKeyProvider,
  setNewKeyProvider,
  newKeyValue,
  setNewKeyValue,
  showAddKey,
  setShowAddKey,
  rotatingKeyId,
  setRotatingKeyId,
  rotateValue,
  setRotateValue,
  isRotating,
  handleAddKey,
  handleRotateKey,
}: ApiKeysTabProps) {
  return (
    <Card className="border-[var(--ag-cyan)]/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription className="text-[var(--ag-text-muted)]">
              Manage provider keys for &quot;Bring Your Own&quot; mode
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowAddKey(true)}
            className="bg-gradient-to-r from-[#8B5CF6] to-[#D97706] hover:from-[#7C3AED] hover:to-[#C2410C] min-h-[44px] text-white font-semibold transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />Add Key
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {apiKeys.length === 0 && !showAddKey && (
          <div className="text-center py-8">
            <Key className="w-10 h-10 text-[var(--ag-cyan)]/30 mx-auto mb-3" />
            <p className="text-[var(--ag-text-muted)] mb-2">No API keys added yet</p>
            <p className="text-sm text-[var(--ag-text-muted)]">Add your provider keys to use your own credits</p>
          </div>
        )}

        {apiKeys.map((key) => (
          <div key={key.id} className="rounded-xl border border-[var(--ag-cyan)]/20 overflow-hidden">
            <div className="flex items-center justify-between p-4 gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: `${PROVIDER_COLORS[key.provider] ?? '#A78BFA'}20` }}
                >
                  {PROVIDER_EMOJI[key.provider] ?? '🔑'}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-[var(--ag-text-primary)] truncate">{key.label}</div>
                  <div className="text-sm text-[var(--ag-text-muted)] font-mono truncate">
                    {key.maskedKey.length > 12
                      ? `${key.maskedKey.slice(0, 4)}...${key.maskedKey.slice(-4)}`
                      : key.maskedKey}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRotatingKeyId(rotatingKeyId === key.id ? null : key.id);
                    setRotateValue('');
                  }}
                  className="text-[var(--ag-cyan)]/70 hover:text-[var(--ag-cyan)] text-xs px-2"
                >
                  Rotate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setApiKeys(apiKeys.filter((k) => k.id !== key.id))}
                  className="text-[#FF6161] hover:text-[#FF6161]"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {rotatingKeyId === key.id && (
              <div className="px-4 pb-4 flex gap-2 border-t border-[var(--ag-cyan)]/10 pt-3">
                <Input
                  type="password"
                  placeholder="Paste new key value…"
                  value={rotateValue}
                  onChange={(e) => setRotateValue(e.target.value)}
                  className="flex-1 text-sm bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)]"
                />
                <Button
                  size="sm"
                  disabled={isRotating || rotateValue.trim().length < 8}
                  onClick={() => handleRotateKey(key.id)}
                  className="bg-[#A78BFA]/10 text-[var(--ag-cyan)] hover:bg-[#A78BFA]/20 border border-[var(--ag-cyan)]/30"
                >
                  {isRotating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                </Button>
              </div>
            )}
          </div>
        ))}

        {showAddKey && (
          <div className="p-4 rounded-xl border border-[var(--ag-cyan)]/30 space-y-3">
            <div>
              <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Provider</label>
              <div className="flex gap-2 flex-wrap">
                {PROVIDERS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewKeyProvider(p)}
                    className={`px-3 py-2 min-h-[44px] rounded-lg text-sm capitalize transition-all ${
                      newKeyProvider === p
                        ? 'bg-[#A78BFA]/20 border border-[var(--ag-cyan)] text-[var(--ag-cyan)]'
                        : 'bg-[var(--ag-bg-surface)] border border-[var(--ag-cyan)]/20 text-[var(--ag-text-muted)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">API Key</label>
              <Input
                type="password"
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder="sk-..."
                className="bg-[var(--ag-bg-surface)] border-[var(--ag-cyan)]/30 text-[var(--ag-text-primary)] font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setShowAddKey(false); setNewKeyValue(''); }}
                className="border-[var(--ag-cyan)]/30"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddKey}
                disabled={!newKeyValue}
                className="bg-gradient-to-r from-[#8B5CF6] to-[#D97706] hover:from-[#7C3AED] hover:to-[#C2410C] min-h-[44px] text-white font-semibold transition-all duration-200"
              >
                Save Key
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
