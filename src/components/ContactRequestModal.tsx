// ============================================================
// Contact Request Modal
// UI for initiating human-to-human contact
// ============================================================

import { useState } from 'react';
import { X, Send, User, Phone, Mail, MessageSquare, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

interface ContactRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  toUserId: string;
  toUserName: string;
  source: 'explore' | 'portfolio';
  onRequestCreated?: (requestId: string) => void;
}

export function ContactRequestModal({
  isOpen,
  onClose,
  toUserId,
  toUserName,
  source,
  onRequestCreated,
}: ContactRequestModalProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [step, setStep] = useState<'form' | 'submitting' | 'waiting' | 'error'>('form');
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState('');

  // Form state
  const [fromName, setFromName] = useState(user?.name || '');
  const [fromPhone, setFromPhone] = useState('');
  const [fromEmail, setFromEmail] = useState(user?.email || '');
  const [intention, setIntention] = useState('');
  const [initialMessage, setInitialMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setStep('submitting');
    setError('');

    try {
      const response = await fetch('/api/contact/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId,
          source,
          fromName: isAuthenticated ? undefined : fromName,
          fromPhone: isAuthenticated ? undefined : fromPhone,
          fromEmail: isAuthenticated ? undefined : fromEmail,
          intention,
          initialMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.nextStep === 'collect_contact_details') {
          setStep('form');
          setError('Please provide your contact details to continue.');
          return;
        }
        throw new Error(data.error || 'Failed to create request');
      }

      setRequestId(data.requestId);
      setStep('waiting');
      onRequestCreated?.(data.requestId);
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const isFormValid = () => {
    if (isAuthenticated) {
      return intention.trim().length > 0 || initialMessage.trim().length > 0;
    }
    return (
      fromName.trim().length > 0 &&
      fromPhone.trim().length >= 10 &&
      (intention.trim().length > 0 || initialMessage.trim().length > 0)
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card-v2 border border-[#00F0FF]/20 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#00F0FF]/10">
          <h3 className="text-lg font-semibold text-[#E8E8F0]">
            Contact {toUserName}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B7280] hover:text-white hover:bg-[#00F0FF]/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {step === 'form' && (
            <>
              {/* Info banner */}
              <div className="p-3 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/20">
                <p className="text-sm text-[#6B7280]">
                  {toUserName} will review your request and can accept or decline. 
                  If accepted, you'll be able to chat directly.
                </p>
              </div>

              {/* Guest contact details */}
              {!isAuthenticated && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-[#6B7280] mb-1.5 block">Your Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                      <Input
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        placeholder="John Doe"
                        className="pl-10 bg-[#06060B] border-[#00F0FF]/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-[#6B7280] mb-1.5 block">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                      <Input
                        value={fromPhone}
                        onChange={(e) => setFromPhone(e.target.value)}
                        placeholder="+1 234 567 8900"
                        className="pl-10 bg-[#06060B] border-[#00F0FF]/20"
                      />
                    </div>
                    <p className="text-xs text-[#6B7280] mt-1">
                      Required so {toUserName} can reach you if needed
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-[#6B7280] mb-1.5 block">Email (optional)</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                      <Input
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="pl-10 bg-[#06060B] border-[#00F0FF]/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Intention */}
              <div>
                <label className="text-sm text-[#6B7280] mb-1.5 block">What do you want to discuss? *</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-[#6B7280]" />
                  <textarea
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                    placeholder="e.g., Collaboration opportunity, question about your portfolio..."
                    rows={3}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#06060B] border border-[#00F0FF]/20 text-[#E8E8F0] placeholder-[#6B7280] focus:outline-none focus:border-[#00F0FF]/40 resize-none"
                  />
                </div>
              </div>

              {/* Initial message */}
              <div>
                <label className="text-sm text-[#6B7280] mb-1.5 block">Your message (optional)</label>
                <textarea
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Add more details..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#06060B] border border-[#00F0FF]/20 text-[#E8E8F0] placeholder-[#6B7280] focus:outline-none focus:border-[#00F0FF]/40 resize-none"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-[#FF3366]/10 border border-[#FF3366]/20 text-sm text-[#FF3366]">
                  {error}
                </div>
              )}
            </>
          )}

          {step === 'submitting' && (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 text-[#00F0FF] animate-spin mx-auto mb-4" />
              <p className="text-[#6B7280]">Sending request...</p>
            </div>
          )}

          {step === 'waiting' && (
            <div className="py-8 text-center">
              <Clock className="w-16 h-16 text-[#FFB800] mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-[#E8E8F0] mb-2">Request Sent!</h4>
              <p className="text-[#6B7280] mb-4">
                Waiting for {toUserName} to accept. You'll be notified when they respond.
              </p>
              <div className="p-3 rounded-lg bg-[#06060B] text-left">
                <p className="text-xs text-[#6B7280] mb-1">Request ID</p>
                <p className="text-sm text-[#E8E8F0] font-mono">{requestId}</p>
              </div>
              <Button onClick={onClose} className="mt-6 bg-[#00F0FF] hover:bg-[#00D4B0]">
                Got it
              </Button>
            </div>
          )}

          {step === 'error' && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-[#FF3366]/10 flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-[#FF3366]" />
              </div>
              <h4 className="text-lg font-semibold text-[#E8E8F0] mb-2">Something went wrong</h4>
              <p className="text-[#6B7280] mb-4">{error}</p>
              <Button onClick={() => setStep('form')} variant="outline" className="border-[#00F0FF]/30">
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'form' && (
          <div className="flex gap-3 p-4 border-t border-[#00F0FF]/10">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-[#00F0FF]/30 text-[#6B7280]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid()}
              className="flex-1 bg-[#00F0FF] hover:bg-[#00D4B0] disabled:opacity-50"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Request
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
