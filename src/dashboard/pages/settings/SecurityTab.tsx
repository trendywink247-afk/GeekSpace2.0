import { Key, Loader2, Trash2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { FreeModel } from '@/types';

interface SecurityTabProps {
  preferredModel: string;
  handleSaveModel: (model: string) => void;
  modelSaving: boolean;
  preferredFreeModel: string;
  setPreferredFreeModel: (v: string) => void;
  freeModels: FreeModel[];
  freeModelSaving: boolean;
  setFreeModelSaving: (v: boolean) => void;
  showSavedToast: () => void;
  onSaveFreeModel: (val: string) => void;
  // password change
  pwCurrent: string;
  setPwCurrent: (v: string) => void;
  pwNew: string;
  setPwNew: (v: string) => void;
  pwConfirm: string;
  setPwConfirm: (v: string) => void;
  pwError: string;
  setPwError: (v: string) => void;
  pwSuccess: string;
  setPwSuccess: (v: string) => void;
  pwSaving: boolean;
  onChangePassword: () => void;
  // delete account
  deletePassword: string;
  setDeletePassword: (v: string) => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (v: string) => void;
  deleteError: string;
  setDeleteError: (v: string) => void;
  isDeleting: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  onDeleteAccount: () => void;
}

const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto (Recommended)', desc: 'Agentin picks the best engine for each task' },
  { value: 'local', label: 'Local Engine (Ollama)', desc: 'Fastest, no cloud — runs on-device' },
  { value: 'cloud', label: 'Cloud Engine (OpenRouter)', desc: 'More capable, uses your credits' },
  { value: 'premium', label: 'Premium (Edith / Kimi K2)', desc: 'Most powerful — highest credit cost' },
];

function PasswordStrengthMeter({ password }: { password: string }) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const segmentColors = [
    'bg-[#EF4444]',
    'bg-[#F97316]',
    'bg-[#EAB308]',
    'bg-[#22C55E]',
    'bg-[#A78BFA]',
  ];

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < score ? segmentColors[score - 1] : 'bg-[var(--ag-bg-surface)]'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${segmentColors[score - 1].replace('bg-', 'text-')}`}>
        {labels[score - 1] ?? ''}
      </p>
    </div>
  );
}

export function SecurityTab({
  preferredModel,
  handleSaveModel,
  modelSaving,
  preferredFreeModel,
  freeModels,
  freeModelSaving,
  onSaveFreeModel,
  pwCurrent,
  setPwCurrent,
  pwNew,
  setPwNew,
  pwConfirm,
  setPwConfirm,
  pwError,
  setPwError,
  pwSuccess,
  setPwSuccess,
  pwSaving,
  onChangePassword,
  deletePassword,
  setDeletePassword,
  deleteConfirmText,
  setDeleteConfirmText,
  deleteError,
  setDeleteError,
  isDeleting,
  showDeleteConfirm,
  setShowDeleteConfirm,
  onDeleteAccount,
}: SecurityTabProps) {
  return (
    <div className="space-y-6">
      {/* Preferred AI Engine */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardHeader>
          <CardTitle>Preferred AI Engine</CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">
            Choose which AI model powers your assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSaveModel(opt.value)}
              disabled={modelSaving}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                preferredModel === opt.value
                  ? 'bg-[#A78BFA]/10 border-[var(--ag-cyan)] text-[var(--ag-cyan)]'
                  : 'border-[var(--ag-cyan)]/20 text-[var(--ag-text-primary)] hover:border-[var(--ag-cyan)]/50'
              }`}
            >
              <div className="font-medium text-sm">{opt.label}</div>
              <div className="text-xs text-[var(--ag-text-muted)] mt-0.5">{opt.desc}</div>
            </button>
          ))}
          {modelSaving && (
            <div className="flex items-center gap-2 text-[var(--ag-text-muted)] text-sm">
              <Loader2 className="w-3 h-3 animate-spin" />Saving...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferred Free Model */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardHeader>
          <CardTitle>Preferred Free Model</CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">
            Pick which OpenRouter free model to use when cloud mode is selected
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={preferredFreeModel}
            onChange={(e) => onSaveFreeModel(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 rounded-xl text-[var(--ag-text-primary)] text-sm focus:outline-none"
          >
            <option value="auto">Auto (Agentin selects best available)</option>
            {freeModels.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>
          {freeModelSaving && (
            <div className="flex items-center gap-2 text-[var(--ag-text-muted)] text-sm">
              <Loader2 className="w-3 h-3 animate-spin" />Saving...
            </div>
          )}
          <p className="text-xs text-[var(--ag-text-muted)]">
            Only applies when your engine is set to Cloud or Auto. Free models have usage limits.
          </p>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Current Password</label>
            <Input
              type="password"
              value={pwCurrent}
              onChange={(e) => { setPwCurrent(e.target.value); setPwError(''); setPwSuccess(''); }}
              placeholder="Enter current password"
              className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)]"
            />
          </div>
          <div>
            <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">New Password</label>
            <Input
              type="password"
              value={pwNew}
              onChange={(e) => { setPwNew(e.target.value); setPwError(''); setPwSuccess(''); }}
              placeholder="Enter new password"
              className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)]"
            />
            {pwNew.length > 0 && <PasswordStrengthMeter password={pwNew} />}
          </div>
          <div>
            <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Confirm New Password</label>
            <Input
              type="password"
              value={pwConfirm}
              onChange={(e) => { setPwConfirm(e.target.value); setPwError(''); setPwSuccess(''); }}
              placeholder="Confirm new password"
              className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)]"
            />
          </div>
          {pwError && <p className="text-sm text-[#EF4444]">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-[#00FF88]">{pwSuccess}</p>}
          <Button
            disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
            onClick={onChangePassword}
            className="bg-gradient-to-r from-[#8B5CF6] to-[#D97706] hover:from-[#7C3AED] hover:to-[#C2410C] min-h-[44px] text-white font-semibold transition-all duration-200"
          >
            {pwSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Key className="w-4 h-4 mr-2" />Update Password</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border border-[#FF2D78]/30 bg-[#FF2D78]/[0.03]">
        <CardHeader>
          <CardTitle className="text-[#FF2D78] flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Danger Zone
          </CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">
            Actions here are irreversible. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[#FF2D78]/5 border border-[#FF2D78]/20">
            <Shield className="w-4 h-4 text-[#FF2D78] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--ag-text-muted)]">
              Deleting your account will permanently erase all conversations, reminders,
              automations, memories, documents, and settings. This action cannot be reversed.
            </p>
          </div>

          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              className="border-[#FF2D78]/40 text-[#FF2D78] hover:bg-[#FF2D78]/10 hover:border-[#FF2D78]/60"
              onClick={() => {
                setShowDeleteConfirm(true);
                setDeleteError('');
                setDeletePassword('');
                setDeleteConfirmText('');
              }}
              data-testid="delete-account-open-btn"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete My Account
            </Button>
          ) : (
            <div className="space-y-3 p-4 rounded-xl bg-[#FF2D78]/[0.03] border border-[#FF2D78]/20">
              <p className="text-sm text-[var(--ag-text-primary)] font-medium">
                To confirm, type{' '}
                <span className="text-[#FF2D78] font-bold font-mono">DELETE</span> below, then
                enter your password.
              </p>
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1.5 block">
                  Type DELETE to confirm
                </label>
                <Input
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className={`bg-[var(--ag-bg-surface)] text-[var(--ag-text-primary)] font-mono tracking-wider ${
                    deleteConfirmText === 'DELETE'
                      ? 'border-[#FF2D78]/60 focus:border-[#FF2D78]/80'
                      : 'border-[#FF2D78]/20 focus:border-[#FF2D78]/40'
                  }`}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1.5 block">
                  Your current password
                </label>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="bg-[var(--ag-bg-surface)] border-[#FF2D78]/20 focus:border-[#FF2D78]/40 text-[var(--ag-text-primary)]"
                  data-testid="delete-account-password-input"
                />
              </div>
              {deleteError && <p className="text-xs text-[#FF2D78]">{deleteError}</p>}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword('');
                    setDeleteConfirmText('');
                    setDeleteError('');
                  }}
                  className="border-[var(--ag-cyan)]/20 text-[var(--ag-text-muted)]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isDeleting || deletePassword.length < 6 || deleteConfirmText !== 'DELETE'}
                  onClick={onDeleteAccount}
                  className="bg-[#FF2D78] hover:bg-[#E0266A] text-white disabled:opacity-40"
                  data-testid="delete-account-confirm-btn"
                >
                  {isDeleting ? (
                    <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Deleting…</>
                  ) : (
                    'Permanently Delete Account'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
