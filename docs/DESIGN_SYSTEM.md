# GeekSpace 2.0 — Design System Reference

> Single source of truth for visual consistency across all pages. Every new component
> and page **must** follow this guide to maintain the premium, cohesive look.

## Brand Identity

GeekSpace / Agentin uses a **dark-first, futuristic aesthetic** with glass morphism,
aurora gradients, and neon accents. The visual language evokes a command-center feel —
sophisticated AI tooling wrapped in a premium, responsive interface.

---

## Color Palette

### Primary Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `agentin-cyan` | `#00F0FF` | Primary accent, interactive elements, links, focus rings |
| `agentin-magenta` | `#FF2D78` | Alerts, destructive actions, energy accents |
| `agentin-violet` | `#8B5CF6` | CTA primary, gradients, brand identity |
| `agentin-black` | `#06060f` | Body background, deepest layer |
| `agentin-surface` | `#0C0C18` | Card backgrounds, elevated surfaces |
| `agentin-card` | `#10101E` | Card interiors, form backgrounds |
| `agentin-lime` | `#ADFF2F` | Success states, active indicators, Jarvis agent |
| `agentin-gold` | `#FFD700` | Premium badges, CTA gradient end |

### Accent Shortcuts (Tailwind)

```
accent-violet: #8B5CF6    accent-cyan: #00F0FF
accent-gold:   #F59E0B    accent-rose: #F43F5E
```

### CTA Gradient

```css
/* Violet → Gold — used for primary call-to-action buttons and text */
background: linear-gradient(135deg, #8B5CF6 0%, #F59E0B 100%);
```
Tailwind: `cta-from: #8B5CF6`, `cta-to: #F59E0B`
CSS class: `.cta-gradient` (text) or use `bg-gradient-to-r from-cta-from to-cta-to` (backgrounds)

### Depth Layers (Dark Mode)

Five background layers create visual hierarchy through subtle depth:

| Layer | Hex | CSS Variable | When to use |
|-------|-----|-------------|-------------|
| **Void** | `#020209` | `--layer-void` | Page background, deepest areas |
| **Base** | `#06061a` | `--layer-base` | Main content area background |
| **Raised** | `#0a0a24` | `--layer-raised` | Slightly elevated sections |
| **Card** | `#0f0f2a` | `--layer-card` | Cards, modals, dropdowns |
| **Overlay** | `#15153a` | `--layer-overlay` | Tooltips, popovers, overlays |

### Depth Layers (Light Mode)

| Layer | Hex | CSS Variable |
|-------|-----|-------------|
| **Void** | `#F0F2F8` | `--layer-void` |
| **Base** | `#F8F9FC` | `--layer-base` |
| **Raised** | `#FFFFFF` | `--layer-raised` |
| **Card** | `#F1F3F8` | `--layer-card` |
| **Overlay** | `#E8EBF2` | `--layer-overlay` |

### Agent-Specific Colors

Each AI agent has a signature color for avatar rings, status indicators, and themed UI:

| Agent | Color | Hex | CSS Variable |
|-------|-------|-----|-------------|
| Weebo | Cyan | `#00F0FF` | `--ag-weebo` |
| Edith | Violet | `#8B5CF6` | `--ag-edith` |
| Jarvis | Lime | `#ADFF2F` | `--ag-jarvis` |
| Aria | Pink | `#FF6B9D` | `--ag-aria` |
| Forge | Amber | `#F59E0B` | `--ag-forge` |
| Pulse | Green | `#10B981` | `--ag-pulse` |
| Echo | Indigo | `#6366F1` | `--ag-echo` |
| Cal | Lime | `#84CC16` | `--ag-cal` |
| Nova | Magenta | `#EC4899` | `--ag-nova` |

### Text Hierarchy

| Level | Dark Mode | Light Mode | CSS Variable |
|-------|-----------|------------|-------------|
| Primary | `#F1F5F9` | `#1E293B` | `--text-primary` |
| Secondary | `#CBD5E1` | `#475569` | `--text-secondary` |
| Muted | `#94A3B8` | `#64748B` | `--text-muted` |
| Dim | `#64748B` | `#94A3B8` | `--text-dim` |

### Surface Opacities

```
--surface-1: rgba(255,255,255, 0.02)   /* Barely visible hover */
--surface-2: rgba(255,255,255, 0.04)   /* Subtle background */
--surface-3: rgba(255,255,255, 0.06)   /* Default surface */
--surface-4: rgba(255,255,255, 0.08)   /* Elevated surface */
--surface-5: rgba(255,255,255, 0.12)   /* Active/selected */
```

---

## Typography

### Font Stack

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| **Headings** | Syne | 400–800 | h1–h6, display text, section titles |
| **Body** | Space Grotesk | 400–700 | Paragraphs, labels, inputs, buttons |
| **Code** | JetBrains Mono | 400–600 | Code blocks, terminal output, monospace |

Loaded from Google Fonts in `src/index.css`.

### Fluid Type Scale

All sizes use `clamp()` for responsive scaling:

| Token | Min → Max | Usage |
|-------|-----------|-------|
| `--text-display` | 3rem → 6rem | Hero headlines |
| `--text-h1` | 2.25rem → 3.5rem | Page titles |
| `--text-h2` | 1.5rem → 2rem | Section headings |
| `--text-h3` | 1.125rem → 1.5rem | Subsection headings |
| `--text-body` | 1rem → 1.125rem | Body text |
| `--text-caption` | 0.75rem → 0.875rem | Captions, labels |
| `--text-micro` | 0.6875rem (fixed) | Badges, timestamps |

### Text Gradient Utilities

```css
.text-gradient          /* Violet → Emerald */
.cta-gradient           /* Violet → Gold (CTA) */
.text-gradient-violet   /* Violet → Cyan */
.text-gradient-lime     /* Cyan → Lime */
```

---

## Spacing

### Fluid Spacing Tokens

| Token | Min → Max | Tailwind | Usage |
|-------|-----------|----------|-------|
| `--space-section` | 80px → 160px | `p-section` | Between major page sections |
| `--space-block` | 48px → 80px | `p-block` | Between content blocks |
| `--space-element` | 24px → 40px | `p-element` | Between related elements |
| `--space-tight` | 12px → 20px | `p-tight` | Tight gaps, inline spacing |

### Border Radius

```
--radius: 0.75rem (12px base)
xs: calc(var(--radius) - 6px)   = 6px
sm: calc(var(--radius) - 4px)   = 8px
md: calc(var(--radius) - 2px)   = 10px
lg: var(--radius)               = 12px
xl: calc(var(--radius) + 4px)   = 16px
```

---

## Effects

### Glass Morphism

Two glass card variants are available:

**`.glass-card`** — Standard glass:
```css
background: rgba(12, 12, 24, 0.75);
backdrop-filter: blur(16px);
border: 1px solid rgba(0, 240, 255, 0.15);
```

**`.glass-card-v2`** — Enhanced glass with gradient and deeper blur:
```css
background: linear-gradient(135deg, rgba(12,12,24,0.8), rgba(16,16,30,0.6));
backdrop-filter: blur(24px) saturate(1.4);
border: 1px solid rgba(0, 240, 255, 0.12);
box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03);
```

**CSS Variables** (for custom glass):
```
--glass-bg:     rgba(0, 0, 0, 0.40)
--glass-border: rgba(255, 255, 255, 0.08)
--glass-shadow: 0 4px 24px rgba(0, 0, 0, 0.3)
```

### Glow Effects (Tailwind shadows)

| Class | Color | Usage |
|-------|-------|-------|
| `shadow-glow-cyan` | Emerald green | Active states, focus |
| `shadow-glow-magenta` | Magenta | Alerts, errors |
| `shadow-glow-dual` | Cyan + Magenta | Premium elements |
| `shadow-glow-lime` | Lime green | Success, online status |
| `shadow-glow-gold` | Gold | Premium badges |

### Special Effects (CSS classes)

| Class | Effect |
|-------|--------|
| `.neon-border` | Animated gradient border (cyan → lime → magenta → violet) |
| `.orbit-glow` | Rotating border ring (cyan + lime) |
| `.grid-distort` | Perspective grid background |
| `.noise-overlay` | SVG fractal noise texture |
| `.scanlines` | CRT scanline effect |
| `.holographic` | Holographic color shift |
| `.glitch-text` | Glitch text animation |
| `.plasma-border` | Plasma-style animated border |

### Borders

```
--border-subtle:  rgba(255,255,255, 0.04)   /* Default card borders */
--border-default: rgba(255,255,255, 0.06)   /* Standard borders */
--border-hover:   rgba(255,255,255, 0.12)   /* Hover state */
--border-active:  rgba(255,255,255, 0.18)   /* Active/focused */
```

Tailwind shortcuts: `border-subtle`, `border-subtle-hover`

---

## Motion & Animation

### Duration Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | 150ms | Micro-interactions (hover, toggle) |
| `--duration-normal` | 300ms | Standard transitions (fade, slide) |
| `--duration-slow` | 600ms | Entrance animations, page transitions |

### Easing Functions

| Token | Curve | Usage |
|-------|-------|-------|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Modal opens, page enters |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Button press, bouncy feedback |

### Key Animations (Tailwind)

| Animation | Duration | Usage |
|-----------|----------|-------|
| `animate-shimmer` | 1.5s | Loading skeletons |
| `animate-modal-spring-in` | 0.35s | Modal entrance |
| `animate-step-slide-in` | 0.35s | Onboarding step transitions |
| `animate-welcome-in` | 0.5s | Welcome screen elements |
| `animate-orbit` | 8s | Orbiting decorative elements |
| `animate-pulse-lime` | 3s | Active status pulse |
| `animate-aurora-shift` | 15s | Background aurora movement |
| `animate-gradient-text-flow` | 6s | Gradient text animation |
| `animate-marquee-scroll` | 40s | Horizontal marquee |

### Motion Guidelines

- **Entrance only** — Animate elements in; avoid exit animations unless dismissing
- **Subtle by default** — Use `--ag-transition-fast` (150ms) for most interactions
- **Spring for feedback** — Use `--ease-spring` for button presses and interactive elements
- **Reduce motion** — Respect `prefers-reduced-motion` by using Tailwind's `motion-reduce:` prefix

---

## Component Patterns

### Button (shadcn/ui)

Located in `src/components/ui/button.tsx`. Variants:

| Variant | Style | Usage |
|---------|-------|-------|
| `default` | Primary filled | Main actions |
| `destructive` | Red filled | Delete, destructive actions |
| `outline` | Border only | Secondary actions |
| `secondary` | Muted fill | Tertiary actions |
| `ghost` | Transparent | Toolbar actions, subtle interactions |
| `link` | Underlined text | Inline text links |

All buttons have `active:scale-[0.97]` for press feedback.

### Card (shadcn/ui)

Located in `src/components/ui/card.tsx`. Uses glass morphism:
```
bg-card/50 backdrop-blur-sm border-white/[0.06]
background-image: linear-gradient(135deg, rgba(255,255,255,0.02), transparent)
```

### Input (shadcn/ui)

Dark mode styling with focus ring matching the primary accent color.

### Badge (shadcn/ui)

Rounded-full, multiple variants (default, secondary, destructive, outline).

### Full Component List

37 components in `src/components/ui/`: alert, avatar, badge, bottom-sheet, button, calendar, card, chart, checkbox, collapsible, command, dialog, drawer, empty, field, form, input, item, kbd, label, mobile-table, page-progress, popover, progress, radio-group, select, separator, sheet, sidebar, skeleton, slider, switch, table, tabs, textarea, toggle, tooltip.

---

## Theme System

### How It Works

Theme is managed by a Zustand store (`src/stores/themeStore.ts`):

```typescript
mode: 'system' | 'light' | 'dark'   // Default: 'dark'
accentColor: string                   // Default: '#8B5CF6' (violet)
accentPresets: string[]               // 8 preset colors
```

- Persisted to `localStorage` key: `gs-theme`
- Applies `dark` or `light` class to `<html>` element
- Sets `data-theme` attribute for CSS selectors
- Custom accent set via `--accent-dynamic` CSS property

### Dark Mode (Default)

The app is dark-first. All CSS variables in `:root` define the dark palette. The `.light` class overrides depth layers, text hierarchy, surfaces, glass effects, and landing page colors.

### Accent Customization

Users can pick from 8 presets or a custom hex color. The accent is applied via `--accent-dynamic` CSS property and read by components that need dynamic theming.

---

## Page-Specific Guidelines

### Landing Page (`src/landing/LandingPage.tsx`)

- **Background**: `NeuralBackground` canvas (particle system + aurora waves) with noise overlay
- **Section rhythm**: Use `--space-section` between major sections
- **11 sections** flow top-to-bottom: Hero → FreeTools → TrustStrip → SocialProof → ProblemSolution → Persona → PromptTemplates → Infra → Constellation → TelegramCTA → PricingPreview → Contact → Footer
- **Landing-specific CSS vars**: `--lp-bg`, `--lp-glass-bg`, `--lp-text-primary` etc.
- **3D hero**: `HeroScene3D.tsx` using Three.js / React Three Fiber
- **Sticky mobile CTA**: Always visible on mobile viewports

### Login Page (`src/onboarding/LoginPage.tsx`)

- **Layout**: Split — visual showcase (left, desktop only) + form (right)
- **OAuth-first**: Google and GitHub buttons prominent above email/password
- **Glass card**: `LoginMagicCard.tsx` wraps the form
- **Background**: `AuthPageBackground.tsx` with `#06061a` base
- **Password strength**: 3-level indicator (weak/medium/strong)
- **Trust badges**: Below form for social proof
- **Demo login**: Quick access button for trying the app
- **Mobile**: `MobileConstellationHero.tsx` replaces the desktop left panel

### Onboarding (`src/onboarding/OnboardingWizard.tsx`)

- **8-step wizard**: Profile → Bio → UseCase → Agent → Portfolio → Integrations → FreeTier → GuidedFirstTask
- **Transitions**: `animate-step-slide-in` / `animate-step-slide-out` between steps
- **Progress**: Visual progress bar with step count and estimated time
- **Skip**: Modal confirmation before skipping remaining steps
- **Per-step data saving**: Each step saves independently

---

## Do's and Don'ts

### Do

- Use the depth layer system for background hierarchy
- Apply `glass-card` or `glass-card-v2` for elevated containers
- Use Syne for headings, Space Grotesk for body text
- Use fluid spacing tokens (`--space-section`, `--space-block`, etc.)
- Apply `--ease-out-expo` for entrance animations
- Use `shadow-glow-*` classes for interactive element focus states
- Keep dark mode as the primary design target
- Use `cn()` from `src/lib/utils.ts` for conditional class composition
- Reference agent colors from `--ag-*` tokens for agent-themed UI

### Don't

- Don't use arbitrary hex colors — always reference tokens or Tailwind theme
- Don't add heavy exit animations — entrance-only is the pattern
- Don't use pure white (`#fff`) text in dark mode — use `--text-primary` (`#F1F5F9`)
- Don't use pure black (`#000`) backgrounds — use `--layer-void` (`#020209`)
- Don't mix glass morphism with solid opaque backgrounds in the same card
- Don't skip the font stack — all text must use Syne, Space Grotesk, or JetBrains Mono
- Don't create one-off animation durations — use the 3 duration tokens
- Don't ignore light mode — all new components need `.light` variant support

---

## Source Files

| File | Purpose |
|------|---------|
| `tailwind.config.js` | Colors, fonts, animations, shadows, spacing |
| `src/styles/agentin-tokens.css` | Agentin design tokens (100+ CSS vars) |
| `src/index.css` | Base styles, CSS variables, utility classes |
| `src/stores/themeStore.ts` | Theme state management (Zustand) |
| `src/components/ui/` | 37 shadcn/ui components |
| `src/lib/utils.ts` | `cn()` class composition utility |
| `src/components/NeuralBackground.tsx` | Canvas particle system |
| `components.json` | shadcn/ui config (New York style, Lucide icons) |
