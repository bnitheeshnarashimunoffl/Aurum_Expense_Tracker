/** Branded loading indicator — a small brass arc echoing the Balance Dial ring. */
export default function LoadingRing({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-40 items-center justify-center">
      <svg className="animate-spin" width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <path d="M26 14A12 12 0 0 0 14 2" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  )
}
