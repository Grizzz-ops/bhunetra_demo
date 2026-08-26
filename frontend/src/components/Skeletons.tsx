export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[color-mix(in_srgb,var(--border)_60%,transparent)] ${className}`}
    />
  );
}

export function SiteCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-5 w-16" />
      </div>
      <SkeletonBlock className="h-3 w-32" />
      <SkeletonBlock className="h-3 w-20" />
    </div>
  );
}

export function SiteListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <SiteCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <SkeletonBlock className="h-6 w-40" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-5/6" />
      <SkeletonBlock className="h-24 w-full" />
      <SkeletonBlock className="h-10 w-full" />
    </div>
  );
}
