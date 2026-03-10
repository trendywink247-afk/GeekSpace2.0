import { Hexagon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  userName?: string;
  userEmail?: string;
  onStay: () => void;
  onSignOut: () => void;
}

export function LogoutConfirmDialog({ open, userName, userEmail, onStay, onSignOut }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onStay}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        className="bg-[#0C0C18] border border-white/10 rounded-2xl p-8 space-y-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center mx-auto mb-4">
            <Hexagon className="w-7 h-7 text-[#00F0FF]" />
          </div>
          <h2 id="logout-dialog-title" className="text-xl font-bold text-white mb-1">Leaving so soon?</h2>
          {userName && (
            <p className="text-white/50 text-sm">
              Signed in as <span className="text-white/80 font-medium">{userName}</span>
            </p>
          )}
          {userEmail && (
            <p className="text-white/40 text-xs mt-0.5">{userEmail}</p>
          )}
        </div>

        <p className="text-white/60 text-sm text-center">
          Do you want to sign out of your account?
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={onSignOut}
            variant="outline"
            className="w-full border-[#FF2D78]/40 text-[#FF2D78] hover:bg-[#FF2D78]/10 hover:border-[#FF2D78]"
          >
            Yes, sign out
          </Button>
          <Button
            onClick={onStay}
            autoFocus
            className="w-full bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/20"
          >
            Stay signed in
          </Button>
        </div>
      </div>
    </div>
  );
}
