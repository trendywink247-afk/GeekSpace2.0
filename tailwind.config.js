/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        agentin: {
          cyan: '#00F0FF',
          magenta: '#FF2D78',
          violet: '#8B5CF6',
          black: '#050510',
          surface: '#0C0C18',
          card: '#10101E',
          lime: '#ADFF2F',
          gold: '#FFD700',
        },
        'bg-deep': '#050510',
        'bg-elevated': '#0a0a1a',
      },
      borderColor: {
        subtle: 'rgba(255, 255, 255, 0.06)',
        'subtle-hover': 'rgba(255, 255, 255, 0.12)',
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        'glow-cyan': '0 0 20px rgba(0, 240, 255, 0.15), 0 0 40px rgba(0, 240, 255, 0.05)',
        'glow-magenta': '0 0 20px rgba(255, 45, 120, 0.15), 0 0 40px rgba(255, 45, 120, 0.05)',
        'glow-dual': '0 0 20px rgba(0, 240, 255, 0.12), 0 0 40px rgba(255, 45, 120, 0.08)',
        'glow-lime': '0 0 20px rgba(173, 255, 47, 0.15), 0 0 40px rgba(173, 255, 47, 0.05)',
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.15), 0 0 40px rgba(255, 215, 0, 0.05)',
      },
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "modal-spring-in": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.92)" },
          "60%": { opacity: "1", transform: "translate(-50%, -50%) scale(1.02)" },
          "100%": { transform: "translate(-50%, -50%) scale(1)" },
        },
        "modal-spring-out": {
          "0%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          "100%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.95)" },
        },
        "step-slide-in": {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "step-slide-out": {
          "0%": { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(-24px)" },
        },
        "welcome-in": {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        orbit: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "pulse-lime": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(173, 255, 47, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(173, 255, 47, 0.4), 0 0 80px rgba(173, 255, 47, 0.1)" },
        },
        "float-rotate": {
          "0%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(3deg)" },
          "100%": { transform: "translateY(0) rotate(0deg)" },
        },
        "border-rotate": {
          to: { "--border-angle": "360deg" },
        },
        "shimmer-sweep": {
          "0%, 100%": { transform: "rotate(25deg) translateX(-100%)" },
          "50%": { transform: "rotate(25deg) translateX(100%)" },
        },
        "marquee-scroll": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "aurora-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "gradient-text-flow": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "modal-spring-in": "modal-spring-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "modal-spring-out": "modal-spring-out 0.2s ease-in",
        "step-slide-in": "step-slide-in 0.35s ease-out",
        "step-slide-out": "step-slide-out 0.2s ease-in",
        "welcome-in": "welcome-in 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        orbit: "orbit 8s linear infinite",
        "pulse-lime": "pulse-lime 3s ease-in-out infinite",
        "float-rotate": "float-rotate 8s ease-in-out infinite",
        "border-rotate": "border-rotate 4s linear infinite",
        "shimmer-sweep": "shimmer-sweep 3s ease-in-out infinite",
        "marquee-scroll": "marquee-scroll 40s linear infinite",
        "aurora-shift": "aurora-shift 15s ease-in-out infinite alternate",
        "gradient-text-flow": "gradient-text-flow 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
