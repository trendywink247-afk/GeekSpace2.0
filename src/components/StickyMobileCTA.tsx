// ============================================================
// StickyMobileCTA — Fixed bottom bar, mobile only (hidden md+)
// Hides while hero CTAs are in viewport; slides up when scrolled past
// ============================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface StickyMobileCTAProps {
  onGetStarted: () => void;
}

export function StickyMobileCTA({ onGetStarted }: StickyMobileCTAProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const heroEl = document.getElementById('hero');

    // If hero section is not found, show the bar immediately
    if (!heroEl) {
      setShow(true); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0.1 }
    );

    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          {/* Backdrop */}
          <div className="bg-[var(--ag-bg-base)]/90 backdrop-blur-xl border-t border-white/[0.06] px-4 pt-3">
            <button
              onClick={onGetStarted}
              aria-label="Get started for free"
              className="
                w-full flex items-center justify-center gap-2
                bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B]
                rounded-xl min-h-[48px] px-6
                text-white font-semibold text-base
                transition-shadow duration-200
                hover:shadow-[0_4px_24px_rgba(245,158,11,0.25)]
                active:scale-[0.98]
              "
            >
              Get Started — Free
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
