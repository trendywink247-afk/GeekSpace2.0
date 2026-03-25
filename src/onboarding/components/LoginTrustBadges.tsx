export function LoginTrustBadges() {
  const badges = [
    {
      label: "End-to-end encrypted",
      icon: (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="7" width="10" height="7" rx="1" />
          <path d="M5 7V5a3 3 0 016 0v2" />
        </svg>
      ),
    },
    {
      label: "Self-hosted",
      icon: (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="12" height="4" rx="1" />
          <rect x="2" y="10" width="12" height="4" rx="1" />
          <circle cx="5" cy="4" r="0.5" fill="currentColor" />
          <circle cx="5" cy="12" r="0.5" fill="currentColor" />
        </svg>
      ),
    },
    {
      label: "No tracking",
      icon: (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1l6 2v4c0 4-3 7-6 8-3-1-6-4-6-8V3l6-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {badges.map(({ label, icon }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-white/30 text-xs"
        >
          {icon}
          {label}
        </span>
      ))}
    </div>
  );
}
