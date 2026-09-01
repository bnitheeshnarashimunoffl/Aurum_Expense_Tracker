import { useId } from 'react'

/**
 * Kindle's mark: a faceted, geometric ember rather than a soft cartoon flame —
 * gold at the tip, fading through royal purple into dark blue at its base. Used
 * on the Meridian launcher tile and in Kindle's own header.
 */
export default function FlameIcon({ size = 28 }: { size?: number }) {
  const gradientId = useId()

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#F1D9AA" />
          <stop offset="45%" stopColor="#C9A46A" />
          <stop offset="78%" stopColor="#6B4A82" />
          <stop offset="100%" stopColor="#2A2455" />
        </linearGradient>
      </defs>
      <path
        d="M12 2 L15.2 7.6 L13.1 8.8 L16.4 13.2 L12 22 L7.6 13.2 L10.9 8.8 L8.8 7.6 Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  )
}
