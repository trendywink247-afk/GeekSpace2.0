import { useEffect, useRef, useState } from 'react';
import { Mail, Send, CheckCircle, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
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

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Content */}
          <div 
            className={`transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <h2 
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Ready to deploy <span className="text-gradient">your AI?</span>
            </h2>
            
            <p className="text-lg text-[#6B7280] mb-8">
              Request access, set your persona, and go live in days—not months.
            </p>

            {/* Contact Info */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-4 rounded-xl glass-card-v2 border border-[#00F0FF]/20">
                <div className="w-12 h-12 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-[#00F0FF]" />
                </div>
                <div>
                  <div className="text-sm text-[#6B7280]">Email us at</div>
                  <div className="text-lg font-medium text-[#E8E8F0]">hello@agentin.chat</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl glass-card-v2 border border-[#00F0FF]/20">
                <div className="w-12 h-12 rounded-lg bg-[#ADFF2F]/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-[#ADFF2F]" />
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
                  className="px-3 py-1.5 rounded-full bg-[#0C0C18] border border-[#00F0FF]/30 text-sm text-[#6B7280]"
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
                className="mt-6 border-[#00F0FF]/50 text-[#E8E8F0] hover:bg-[#00F0FF]/10"
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
                  <div className="w-16 h-16 rounded-full bg-[#ADFF2F]/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-[#ADFF2F]" />
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
                        className="bg-[#0C0C18] border-[#00F0FF]/30 rounded-xl text-[#E8E8F0] placeholder:text-[#6B7280]/50 focus:border-[#00F0FF] focus:ring-[#00F0FF]/20"
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
                        className="bg-[#0C0C18] border-[#00F0FF]/30 rounded-xl text-[#E8E8F0] placeholder:text-[#6B7280]/50 focus:border-[#00F0FF] focus:ring-[#00F0FF]/20"
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
                      className="bg-[#0C0C18] border-[#00F0FF]/30 rounded-xl text-[#E8E8F0] placeholder:text-[#6B7280]/50 focus:border-[#00F0FF] focus:ring-[#00F0FF]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[#6B7280] mb-2">Message</label>
                    <Textarea
                      placeholder="Tell us about your use case..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="bg-[#0C0C18] border-[#00F0FF]/30 rounded-xl text-[#E8E8F0] placeholder:text-[#6B7280]/50 focus:border-[#00F0FF] focus:ring-[#00F0FF]/20 min-h-[120px] resize-none"
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
                    className="w-full sm:w-auto bg-[#00F0FF] hover:bg-[#6B51EF] text-white py-6 rounded-xl font-medium text-lg transition-all duration-300 hover:shadow-lg hover:shadow-[#00F0FF]/25 group disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#00F0FF]/70"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 w-5 h-5 motion-safe:animate-spin" />
                        <span>Sending...</span>
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

        {/* Footer is now in FooterSection */}
      </div>
    </section>
  );
}