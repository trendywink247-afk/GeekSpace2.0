// PageSkeleton — placeholder shown while lazy-loaded pages are being fetched.
// Matches the general page layout: heading + subtitle + card rows.

export function PageSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/5" />
      <div className="h-4 w-64 rounded-md bg-white/5" />
      <div className="grid grid-cols-1 gap-4 mt-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
