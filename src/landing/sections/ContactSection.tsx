import { useEffect, useRef, useState } from 'react';
import { Send, CheckCircle, ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ContactSectionProps {
  onEnterDashboard?: () => void;
}

export function ContactSection({ onEnterDashboard }: ContactSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setIsSubscribed(true);
      setEmail('');
    }
  };

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="relative py-20 md:py-28 lg:py-32 overflow-hidden"
      data-aos="zoom-in"
    >
      {/* Neural Network Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-[#00F0FF]/50 rounded-full"
            style={{
              left: `${5 + (i % 5) * 22}%`,
              top: `${10 + Math.floor(i / 5) * 35}%`,
              animation: `pulse 3s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 text-center">
        <div
          className={`transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          {/* Header badge */}
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/20 text-sm text-[#00F0FF] font-medium mb-6">
            Get Started
          </span>

          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
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
              className="bg-[#00F0FF] hover:bg-[#6B51EF] text-white px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 hover:shadow-lg hover:shadow-[#00F0FF]/25 group"
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
                className="border-[#00F0FF]/50 text-[#E8E8F0] hover:bg-[#00F0FF]/10 px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300"
              >
                <MessageCircle className="mr-2 w-5 h-5" />
                Talk to Weebo on Telegram
              </Button>
            </a>
          </div>

          <p className="text-sm text-[#6B7280]/70 mb-12">
            No credit card required. Self-host in 5 minutes.
          </p>

          {/* Email Signup */}
          <div
            className={`glass-card rounded-2xl p-6 sm:p-8 max-w-lg mx-auto transition-all duration-700 delay-200 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
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
                    className="flex-1 bg-[#0C0C18] border-[#00F0FF]/30 rounded-xl text-[#E8E8F0] placeholder:text-[#6B7280]/50 focus:border-[#00F0FF] focus:ring-[#00F0FF]/20"
                    required
                  />
                  <Button
                    type="submit"
                    className="bg-[#00F0FF] hover:bg-[#6B51EF] text-white rounded-xl font-medium transition-all duration-300 px-6"
                  >
                    <Send className="mr-2 w-4 h-4" />
                    Subscribe
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
