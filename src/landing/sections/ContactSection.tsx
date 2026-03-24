import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Send, CheckCircle, ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ContactSectionProps {
  onEnterDashboard?: () => void;
}

export function ContactSection({ onEnterDashboard }: ContactSectionProps) {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const reducedMotion = useReducedMotion();

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
      className="relative py-20 md:py-28 lg:py-32 overflow-hidden"
    >
      {/* Gradient mesh background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse 60% 50% at 30% 40%, rgba(0,240,255,0.08) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 60% at 70% 60%, rgba(107,81,239,0.07) 0%, transparent 70%)',
            'radial-gradient(ellipse 80% 40% at 50% 80%, rgba(0,212,176,0.05) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      {/* Subtle dot grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-[#00F0FF] rounded-full"
            style={{
              left: `${5 + (i % 5) * 22}%`,
              top: `${10 + Math.floor(i / 5) * 35}%`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-6">
        <motion.div
          className="text-center"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          {/* Glass container */}
          <div
            className="rounded-3xl max-w-2xl mx-auto p-8 sm:p-12"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* Header badge */}
            <motion.span
              className="inline-block px-4 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/20 text-sm text-[#00F0FF] font-medium mb-6"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Get Started
            </motion.span>

            <h2
              className="text-3xl md:text-4xl lg:text-[44px] font-bold mb-4 leading-tight"
              style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' }}
            >
              Ready to Command <span className="text-gradient">Your AI Team?</span>
            </h2>

            <p className="text-lg text-[#6B7280] mb-8 max-w-xl mx-auto">
              Join 2,000+ Indian professionals who switched to Agentin.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Button
                onClick={onEnterDashboard}
                className="relative overflow-hidden bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] hover:from-[#00D4B0] hover:to-[#6B51EF] text-white px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 hover:shadow-lg hover:shadow-[#00F0FF]/25 group"
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
                  className="border-[#00F0FF]/30 text-[#E8E8F0] hover:bg-[#00F0FF]/10 hover:border-[#00F0FF]/50 px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300"
                >
                  <MessageCircle className="mr-2 w-5 h-5" />
                  Talk to Weebo on Telegram
                </Button>
              </a>
            </div>

            <p className="text-sm text-[#6B7280]/70 mb-10">
              No credit card required. Self-host in 5 minutes.
            </p>

            {/* Divider */}
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#00F0FF]/20 to-transparent mx-auto mb-8" />

            {/* Email Signup — inner glass card */}
            <motion.div
              className="rounded-2xl p-6 sm:p-8 max-w-lg mx-auto"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
              }}
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {isSubscribed ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-[#ADFF2F]/20 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6 text-[#ADFF2F]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#E8E8F0] mb-1">You're on the list!</h3>
                  <p className="text-sm text-[#6B7280]">We'll send you updates and early access features.</p>
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
                      className="flex-1 rounded-xl text-[#E8E8F0] placeholder:text-[#6B7280]/50 transition-all duration-200 focus:ring-2 focus:ring-[#00F0FF]/30 focus:border-[#00F0FF]/50"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                      required
                    />
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-[#00F0FF] to-[#6B51EF] hover:from-[#00D4B0] hover:to-[#00F0FF] text-white rounded-xl font-medium transition-all duration-300 px-6"
                    >
                      <Send className="mr-2 w-4 h-4" />
                      Subscribe
                    </Button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
