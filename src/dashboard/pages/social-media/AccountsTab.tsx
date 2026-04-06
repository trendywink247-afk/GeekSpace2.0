// social-media/AccountsTab.tsx
// Manage connected social media accounts (Instagram, Facebook)
import { useState, useEffect, useCallback } from 'react';
import { SectionCard } from '@/components/agentin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Plus, Trash2, CheckCircle, XCircle, AlertCircle,
  Globe, Send, ToggleLeft, ToggleRight, Webhook, Key,
  Instagram, Facebook,
} from 'lucide-react';
import { socialMediaService } from '@/services/api';
import type { SocialAccount } from '@/services/api';
import { StatusBadge } from './helpers';

interface AccountsTabProps {
  onAccountCreated?: () => void;
}

export function AccountsTab({ onAccountCreated }: AccountsTabProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Form state
  const [platform, setPlatform] = useState<string>('instagram');
  const [accountName, setAccountName] = useState('');
  const [postingMethod, setPostingMethod] = useState<string>('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [pageId, setPageId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadAccounts = useCallback(async () => {
    try {
      const res = await socialMediaService.getAccounts();
      setAccounts(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleCreate = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await socialMediaService.createAccount({
        platform,
        account_name: accountName,
        posting_method: postingMethod,
        webhook_url: postingMethod === 'webhook' ? webhookUrl : undefined,
        page_id: postingMethod === 'api' ? pageId : undefined,
        access_token: postingMethod === 'api' ? accessToken : undefined,
      });
      setShowForm(false);
      setAccountName('');
      setWebhookUrl('');
      setPageId('');
      setAccessToken('');
      loadAccounts();
      onAccountCreated?.();
    } catch {
      setSaveError('Failed to save account. Please check your details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await socialMediaService.deleteAccount(id);
      loadAccounts();
    } catch {
      // silent
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await socialMediaService.testAccount(id);
      setTestResult({ id, ...res.data });
    } catch {
      setTestResult({ id, success: false, message: 'Test request failed' });
    } finally {
      setTesting(null);
    }
  };

  const handleToggleStatus = async (account: SocialAccount) => {
    try {
      await socialMediaService.updateAccount(account.id, {
        status: account.status === 'active' ? 'paused' : 'active',
      });
      loadAccounts();
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ag-violet)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--ag-text-muted)]">
          Connect your social media accounts for automated posting.
        </p>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-gold)] text-white border-0 hover:opacity-90 min-h-[44px] transition-[transform,opacity] active:scale-[0.96]"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Account
        </Button>
      </div>

      {/* Add Account Form */}
      {showForm && (
        <SectionCard className="border-[var(--ag-violet)]/20 bg-[var(--ag-bg-surface)] backdrop-blur-xl">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Platform</label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">
                  Account Name
                </label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="My Business Account"
                  className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">
                Posting Method
              </label>
              <Select value={postingMethod} onValueChange={setPostingMethod}>
                <SelectTrigger className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="api">Direct API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {postingMethod === 'webhook' && (
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">
                  Webhook URL
                </label>
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-webhook.example.com/post"
                  className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)]"
                />
              </div>
            )}

            {postingMethod === 'api' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Page ID</label>
                  <Input
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="Page/Account ID"
                    className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">
                    Access Token
                  </label>
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Long-lived access token"
                    className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)]"
                  />
                </div>
              </div>
            )}

            {saveError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {saveError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px]"
                onClick={() => {
                  setShowForm(false);
                  setSaveError('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={saving || !accountName}
                className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-gold)] text-white border-0 hover:opacity-90 min-h-[44px] transition-[transform,opacity] active:scale-[0.96]"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Plus className="w-4 h-4 mr-1" />
                )}
                Create
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Empty state */}
      {accounts.length === 0 && !showForm && (
        <div className="text-center py-12 px-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--ag-violet)]/10 to-[var(--ag-gold)]/10 border border-[var(--ag-border-subtle)] flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-[var(--ag-violet)] opacity-40" />
          </div>
          <p className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">
            No social accounts connected
          </p>
          <p className="text-xs text-[var(--ag-text-muted)] max-w-xs mx-auto mb-4">
            Connect your Instagram or Facebook to start auto-posting AI-generated content on
            schedule.
          </p>
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-gold)] text-white border-0 hover:opacity-90 min-h-[44px] transition-[transform,opacity] active:scale-[0.96]"
          >
            <Plus className="w-4 h-4 mr-1" /> Connect Account
          </Button>
        </div>
      )}

      {/* Account Cards */}
      <div className="grid gap-3">
        {accounts.map((account) => (
          <SectionCard key={account.id} className="hover:border-[var(--ag-aria)]/20">
            <div className="flex items-center gap-3">
              {/* Platform icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background:
                    account.platform === 'instagram'
                      ? 'linear-gradient(135deg, #833AB4, #FD1D1D, #FCAF45)'
                      : '#1877F2',
                }}
              >
                {account.platform === 'instagram' ? (
                  <Instagram className="w-5 h-5 text-white" />
                ) : (
                  <Facebook className="w-5 h-5 text-white" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--ag-text-primary)] truncate">
                    {account.account_name}
                  </span>
                  <StatusBadge status={account.status} />
                  <Badge
                    variant="outline"
                    className="text-xs text-[var(--ag-text-muted)] border-[var(--ag-border-subtle)]"
                  >
                    {account.posting_method === 'webhook' ? (
                      <Webhook className="w-3 h-3 mr-1" />
                    ) : (
                      <Key className="w-3 h-3 mr-1" />
                    )}
                    {account.posting_method}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--ag-text-muted)]">
                  <span>{account.posts_count} posts</span>
                  {account.last_post_at && (
                    <span>Last: {new Date(account.last_post_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#FF6B9D]/50"
                  onClick={() => handleToggleStatus(account)}
                  aria-label={
                    account.status === 'active'
                      ? 'Pause ' + account.account_name
                      : 'Activate ' + account.account_name
                  }
                >
                  {account.status === 'active' ? (
                    <ToggleRight className="w-4 h-4 text-[var(--ag-success)]" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 text-[var(--ag-text-muted)]" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#FF6B9D]/50"
                  onClick={() => handleTest(account.id)}
                  disabled={testing === account.id}
                  aria-label={'Test ' + account.account_name}
                >
                  {testing === account.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-[var(--ag-violet)]" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#FF6B9D]/50"
                  onClick={() => handleDelete(account.id)}
                  aria-label={'Delete ' + account.account_name}
                >
                  <Trash2 className="w-4 h-4 text-[var(--ag-error)]" />
                </Button>
              </div>
            </div>

            {/* Test result */}
            {testResult && testResult.id === account.id && (
              <div
                className={`mt-2 p-2 rounded-lg text-xs ${
                  testResult.success
                    ? 'bg-[var(--ag-success)]/10 text-[var(--ag-success)]'
                    : 'bg-[var(--ag-error)]/10 text-[var(--ag-error)]'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 inline mr-1" />
                )}
                {testResult.message}
              </div>
            )}
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
