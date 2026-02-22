import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, CheckCircle, Sparkles, Hexagon, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { contactService } from '@/services/api';

interface ContactSectionProps {
  onEnterDashboard?: () => void;
}

export function ContactSection({ onEnterDashboard }: ContactSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { data } = await contactService.submit({
        name: formData.name,
        email: formData.email,
        company: formData.company || undefined,
        message: formData.message,
      });

      if (data.success) {
        setIsSubmitted(true);
        setFormData({ name: '', email: '', company: '', message: '' });
      } else {
        setErrorMessage(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setErrorMessage(
        axiosErr.response?.data?.message || 'Network error. Please try again later.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="relative py-24 overflow-hidden"
    >
      {/* Neural Network Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-[#00FFD4]/50 rounded-full"
            style={{
              left: `${5 + (i % 5) * 22}%`,
              top: `${10 + Math.floor(i / 5) * 35}%`,
              animation: `pulse 3s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Content */}
          <div 
            className={`transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <h2 
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Ready to deploy <span className="text-gradient">your AI?</span>
            </h2>
            
            <p className="text-lg text-[#6B7280] mb-8">
              Request access, set your persona, and go live in days—not months.
            </p>

            {/* Contact Info */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0A0A0F] border border-[#00FFD4]/20">
                <div className="w-12 h-12 rounded-lg bg-[#00FFD4]/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-[#00FFD4]" />
                </div>
                <div>
                  <div className="text-sm text-[#6B7280]">Email us at</div>
                  <div className="text-lg font-medium text-[#E8E8F0]">hello@agentin.chat</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0A0A0F] border border-[#00FFD4]/20">
                <div className="w-12 h-12 rounded-lg bg-[#61FF7B]/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-[#61FF7B]" />
                </div>
                <div>
                  <div className="text-sm text-[#6B7280]">Typical response time</div>
                  <div className="text-lg font-medium text-[#E8E8F0]">Within 24 hours</div>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3">
              {['SOC 2 Compliant', 'GDPR Ready', '99.99% Uptime'].map((badge, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-full bg-[#0A0A0F] border border-[#00FFD4]/30 text-sm text-[#6B7280]"
                >
                  {badge}
                </span>
              ))}
            </div>

            {/* Try Demo Button */}
            {onEnterDashboard && (
              <Button
                onClick={onEnterDashboard}
                variant="outline"
                className="mt-6 border-[#00FFD4]/50 text-[#E8E8F0] hover:bg-[#00FFD4]/10"
              >
                Try Demo Dashboard
              </Button>
            )}
          </div>

          {/* Right: Contact Form */}
          <div 
            className={`transition-all duration-700 delay-200 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
            }`}
          >
            <div className="glass-card rounded-2xl p-5 sm:p-8">
              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[#61FF7B]/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-[#61FF7B]" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#E8E8F0] mb-2">Request Sent!</h3>
                  <p className="text-[#6B7280]">We'll be in touch within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm text-[#6B7280] mb-2">Name</label>
                      <Input
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-[#0A0A0F] border-[#00FFD4]/30 rounded-xl text-[#E8E8F0] placeholder:text-[#6B7280]/50 focus:border-[#00FFD4] focus:ring-[#00FFD4]/20"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[#6B7280] mb-2">Work Email</label>
                      <Input
                        type="email"
                        placeholder="john@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="bg-[#0A0A0F] border-[#00FFD4]/30 rounded-xl text-[#E8E8F0] placeholder:text-[#6B7280]/50 focus:border-[#00FFD4] focus:ring-[#00FFD4]/20"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#6B7280] mb-2">Company</label>
                    <Input
                      placeholder="Acme Inc."
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="bg-[#0A0A0F] border-[#00FFD4]/30 rounded-xl text-[#E8E8F0] placeholder:text-[#6B7280]/50 focus:border-[#00FFD4] focus:ring-[#00FFD4]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[#6B7280] mb-2">Message</label>
                    <Textarea
                      placeholder="Tell us about your use case..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="bg-[#0A0A0F] border-[#00FFD4]/30 rounded-xl text-[#E8E8F0] placeholder:text-[#6B7280]/50 focus:border-[#00FFD4] focus:ring-[#00FFD4]/20 min-h-[120px] resize-none"
                      rows={4}
                    />
                  </div>

                  {errorMessage && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {errorMessage}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#00FFD4] hover:bg-[#6B51EF] text-white py-6 rounded-xl font-medium text-lg transition-all duration-300 hover:shadow-lg hover:shadow-[#00FFD4]/25 group disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 w-5 h-5" />
                        Request Access
                        <Send className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-[#6B7280]/70">
                    We typically reply within 24 hours.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 pt-8 border-t border-[#00FFD4]/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Hexagon className="w-6 h-6 text-[#00FFD4]" />
              <span className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                Agentin
              </span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-[#6B7280]">
              <Link to="/privacy" className="hover:text-[#E8E8F0] transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-[#E8E8F0] transition-colors">Terms</Link>
              <Link to="/docs" className="hover:text-[#E8E8F0] transition-colors">Docs</Link>
              <Link to="/status" className="hover:text-[#E8E8F0] transition-colors">Status</Link>
            </div>
            
            <div className="text-sm text-[#6B7280]/60">
              © 2026 Agentin. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
}