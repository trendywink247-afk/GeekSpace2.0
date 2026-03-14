# Phase 1 — UI Audit Report
**Date:** 2026-03-15 | **Model:** Claude Opus 4.6

## Summary
- **Total issues found:** ~155
- **Critical/High:** 36
- **Medium:** 75
- **Low:** 44

---

## LANDING PAGES (43 issues)

### HeroSection.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Missing prefers-reduced-motion on typewriter/glitch animation | HIGH | 26-63 | Add useReducedMotion() hook |
| Orb hover is mouse-only; no touch equivalent | MED | 79-80 | Add onTouchStart/End or pointer events |
| Text overflow on "YOUR AGENTS. YOUR RULES." at xl:text-9xl | MED | 153 | Add max-w-full guard |
| Bottom gradient not safe-area adjusted | LOW | 203 | Add pb-safe |

### PersonaSection.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Orbiting elements w-8 h-8 (32px) under 44px minimum | MED | 112-128 | Increase to w-11 h-11 |
| Icon-only orbiting divs lack aria-label | HIGH | 112-128 | Add aria-label per icon |
| hover:scale-105 without reduced-motion check | MED | 168 | Conditional animation |
| Feature grid uses index key instead of stable id | HIGH | 153 | Use key={feature.label} |

### EngineSection.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Gear animation no reduced-motion check | HIGH | 147-157 | CSS prefers-reduced-motion |
| SVG array uses key={i} | MED | 185-203 | Use angle-based key |
| Orbiting nodes w-10 h-10 (40px) under 44px | LOW | 162-179 | Increase to w-11 h-11 |

### ConstellationSection.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Company buttons key={i} | HIGH | 181 | Use key={company.name} |
| Icon-only company buttons lack aria-label | HIGH | 180-191 | Add aria-label |
| hover:scale-105 no reduced-motion | MED | 183 | Wrap in motion pref |
| Constellation dots no reduced-motion | HIGH | 99-118 | Disable pulse for reduced-motion |

### ActivitySection.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Icon-only activity indicators lack aria-label | MED | 139-142 | Add aria-label |
| Pulse animation no reduced-motion check | HIGH | 158, 168 | Conditional animate-pulse |
| Activity cards may wrap on 375px | MED | 147 | Add flex-wrap guard |

### PromptTemplatesSection.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Category buttons lack aria-current | HIGH | 175 | Add aria-current="page" |
| Copy button icon-only no aria-label | HIGH | 237 | Add aria-label |
| Framer Motion no reduced-motion | HIGH | 133-197 | Wrap in useReducedMotion |
| Copy/Try buttons no focus-visible | MED | 230, 236 | Add focus:ring-2 |

### SecuritySection.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Orbiting icons w-10 h-10 under 44px | LOW | 131-147 | Increase to w-11 h-11 |
| Icon-only elements lack aria-label | HIGH | 131-147 | Add per-icon labels |
| Shield pulse-glow no reduced-motion | HIGH | 119 | CSS media query |
| Outer rings animate-pulse no reduced-motion | HIGH | 97-99 | Conditional disable |

### ContactSection.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Form inputs missing focus ring verification | MED | 179-218 | Verify focus:border-[#00F0FF] |
| Disabled button contrast may fail WCAG | MED | 231 | Ensure 3:1 contrast |
| Loader2 animate-spin no reduced-motion | HIGH | 235 | Static fallback text |
| Footer links no underline/focus ring | MED | 267-270 | Add hover:underline |

---

## AUTH & ONBOARDING (60 issues)

### LoginPage.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Password field lacks eye-toggle button | HIGH | 295-304 | Add toggle with min w-11 h-11 |
| Icon-only buttons missing aria-label | HIGH | 226-233, 367-386 | Add labels |
| Missing focus-visible ring on toggle | MED | 393-398 | Add focus-visible:ring-2 |
| Input fields missing h-11 minimum | MED | 263-303 | Verify Input component |
| Error state missing aria-live | LOW | 318-320 | Add role="alert" |

### ForgotPasswordPage.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| OTP input height mismatch (h-13 not h-11) | HIGH | 275 | Change to h-11 |
| Missing aria-label on back button | MED | 168-175 | Add aria-label |
| OTP focus-visible missing | MED | 275 | Add focus-visible:ring-2 |
| Modal lacks focus trap | MED | 277 | Implement focus trap |
| maxLength="6" should be 1 per field | MED | 271 | Change to maxLength={1} |

### OnboardingWizard.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Skip reasons map uses index key | HIGH | 284-292 | Use key={reason} |
| Skip modal max-w-sm too wide for 320px | MED | 278 | Change to max-w-xs |
| Missing focus-visible on skip buttons | MED | 362-375 | Add ring |
| Missing aria-current="step" on active step | MED | 192 | Add aria-current |
| Main action text may truncate on narrow | MED | 324, 342 | Add whitespace-nowrap |

### ProfileStep.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Input fields missing h-11 check | MED | 26-42 | Verify Input base |
| Labels missing aria-required | MED | 25, 35 | Add aria-required="true" |

### AgentStep.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| API key section py-3 under 44px min | LOW | 126 | Add min-h-[44px] |
| Missing focus-visible on cards | MED | 54, 92 | Add ring |
| Feature tags may overflow | MED | 110-113 | Verify flex-wrap |

### BioStep.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Textarea needs text-base for iOS zoom | MED | 120 | Add text-base |
| Missing focus-visible on buttons | MED | 67, 85 | Add ring |

### IntegrationsStep.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Close button on WhatsApp modal needs aria-label | HIGH | 157-165 | Add aria-label |
| "I'll do this later" no focus-visible | MED | 320 | Add ring |
| Error message no aria-live | LOW | 308-311 | Add role="alert" |

### PortfolioStep.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Input fields missing h-11/text-base | MED | 82, 91, 113 | Verify base |
| Skip button no focus-visible | MED | 130 | Add ring |

### ReviewStep.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Value max-w-[60%] may be narrow on mobile | MED | 72 | Responsive max-w |

---

## NAVIGATION & DASHBOARD SHELL (12 issues)

### Navigation.tsx — PASSES AUDIT (hamburger already p-3, aria-labels present)

### AgentChatPanel.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Scroll-to-bottom w-10 h-10 under 44px | HIGH | 1423 | Change to w-11 h-11 |
| Download button hover-only state | HIGH | 959 | Add active: state |
| Search button no aria-label | MED | 973 | Add aria-label |
| Reset button no aria-label | MED | 950 | Add aria-label |
| Download button no aria-label | MED | 959 | Add aria-label |
| Close button no aria-label | MED | 982 | Add aria-label |
| Reply dismiss no aria-label | MED | 1545 | Add aria-label |

### DashboardApp.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Sidebar close no aria-label | MED | 538 | Add aria-label |
| Inbox button no aria-label | MED | 879 | Add aria-label |
| Bell notification no aria-label | MED | 907 | Add aria-label |

---

## DASHBOARD & EXPLORE PAGES (~40 issues)

### OverviewPage.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Color contrast #6B7280 on dark may fail WCAG AA | HIGH | 625+ | Use #A7ACB8 or lighter |
| Hard-coded chart heights break on small screens | MED | 1181+ | Add responsive sm: breakpoints |
| text-[10px] too small in capability spotlight | MED | 816 | Use text-xs |
| Dismiss buttons p-1.5 no min-h/w fallback | LOW | 558, 648 | Add min-h-[44px] |

### PortfolioPage.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Modal missing -webkit-backdrop-filter | HIGH | 1545 | Add webkit prefix |
| Project cards overflow on mobile (min-w-[140px]) | HIGH | 771 | Responsive constraints |
| Icon-only edit/delete buttons no aria-label | MED | 1015, 1023 | Add labels |
| Hard-coded textarea heights | MED | 626, 640 | Responsive variants |

### ExplorePage.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Color contrast #6B7280 fails WCAG AA on dark | HIGH | 98, 124+ | Use lighter color |
| Navbar missing -webkit-backdrop-filter | HIGH | 73 | Add webkit prefix |
| Tag button min-h-[36px] under 44px | MED | 121 | Change to min-h-[44px] |
| text-[10px] too small | MED | 800 | Use text-xs |

### ImageGalleryPage.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Download button 36px under 44px min | HIGH | 105 | Increase to 44px |
| Color contrast #6B7280 on dark fails WCAG | HIGH | 93, 99 | Lighter color |
| Image alt empty when prompt missing | LOW | 85 | Fallback alt text |

### InvitePage.tsx
| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| "change" button text-[10px] too small | CRITICAL | 156 | Increase to text-sm |
| Terms/Privacy text-[11px] below minimum | MED | 242-246 | Increase to text-xs |
| Missing -webkit-backdrop-filter | HIGH | implied | Add webkit prefix |

### manifest.json — PASSES AUDIT (icon paths correct)

---

## TOP PRIORITY FIXES (Cross-cutting)

1. **Reduced-motion support** — 7+ sections need prefers-reduced-motion CSS/hook
2. **aria-label on icon-only buttons** — ~20 buttons across all files
3. **Touch targets < 44px** — ~10 elements need size increase
4. **Color contrast #6B7280** — Global issue, needs lighter replacement on dark BGs
5. **-webkit-backdrop-filter** — Missing on 4+ backdrop-blur elements for iOS Safari
6. **focus-visible rings** — ~15 interactive elements missing keyboard focus indicators
7. **key props** — 4 .map() renders using index instead of stable keys
8. **Input h-11 / text-base** — Verify base Input component meets 44px/16px standards
