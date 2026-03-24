import { useState } from 'react';
import { Send, CheckCircle, ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ContactSectionProps {
  onEnterDashboard?: () => void;
}

export function ContactSection({ onEnterDashboard }: ContactSectionProps) {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setIsSubscribed(true);
      setEmail('');
    }
  };

  return (
    <section
      id="contact"
      className="relative overflow-hidden"
      style={{ padding: 'clamp(80px, 12vh, 160px) 0' }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(0,240,255,0.04), transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-10">
          <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#00F0FF]/70 mb-4 block">
            Get Started
          </span>
          <h2
            className="font-bold mb-4 leading-tight"
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 'clamp(2.25rem, 3vw + 0.5rem, 3.5rem)',
              textWrap: 'balance',
            }}
          >
            Ready to Command{' '}
            <span className="text-gradient">Your AI Team?</span>
          </h2>
          <p className="text-lg text-[#94A3B8] max-w-2xl mx-auto">
            Join 2,000+ Indian professionals who switched to Agentin.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          <Button
            onClick={onEnterDashboard}
            className="relative overflow-hidden bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] text-[#06060f] px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-300 hover:shadow-[0_4px_24px_rgba(0,240,255,0.2)] group"
          >
            Start Free &mdash; Rs.0 Forever
            <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>

          <a
            href="https://t.me/Weebo_gs_bot"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              className="border-[#00F0FF]/30 text-[#E8E8F0] hover:bg-[#00F0FF]/10 hover:border-[#00F0FF]/50 px-8 py-3 rounded-xl font-medium text-lg transition-all duration-300"
            >
              <MessageCircle className="mr-2 w-5 h-5" />
              Talk to Weebo on Telegram
            </Button>
          </a>
        </div>

        <p className="text-sm text-[#6B7280]/70 text-center mb-10">
          No credit card required. Self-host in 5 minutes.
        </p>

        {/* Divider */}
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#00F0FF]/20 to-transparent mx-auto mb-8" />

        {/* Email Signup — form/CTA container */}
        <div className="max-w-lg mx-auto rounded-2xl p-8 bg-[#0e0e1c] border border-white/[0.06]">
          {isSubscribed ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#ADFF2F]/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-[#ADFF2F]" />
              </div>
              <h3 className="text-lg font-bold text-[#E8E8F0] mb-1">
                You're on the list!
              </h3>
              <p className="text-sm text-[#6B7280]">
                We'll send you updates and early access features.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[#E8E8F0] font-medium mb-4">
                Get product updates and early access features
              </p>
              <form onSubmit={handleSubscribe} className="flex gap-3">
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-[#E8E8F0] placeholder:text-[#6B7280]/50 focus:border-[#00F0FF]/40 focus:ring-1 focus:ring-[#00F0FF]/20 transition-all"
                  required
                />
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] text-[#06060f] px-8 py-3 rounded-xl font-semibold transition-all hover:shadow-[0_4px_24px_rgba(0,240,255,0.2)]"
                >
                  <Send className="mr-2 w-4 h-4" />
                  Subscribe
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
