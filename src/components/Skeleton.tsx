/** Loading placeholder in the app's own surface tones — never a bare "Loading…" string. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-card ${className}`} />
}

/** Stand-in for a list of TransactionRow-height cards. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
