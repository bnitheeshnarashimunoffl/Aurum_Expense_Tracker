import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        accent: 'var(--accent)',
        income: 'var(--income)',
        expense: 'var(--expense)',
        primary: 'var(--text-primary)',
        muted: 'var(--text-muted)',
        // Text/icons sitting ON a brass accent fill — matches the base background.
        ink: '#0B0D10',

        // Kindle module palette — dark blue/purple base + shared gold accent.
        kindleBase: 'var(--kindle-bg-base)',
        kindleSurface: 'var(--kindle-bg-surface)',
        kindlePurple: 'var(--kindle-purple)',
        kindleComplete: 'var(--kindle-complete)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      borderRadius: {
        card: '20px',
        sheet: '28px',
      },
      boxShadow: {
        'neu-raised': '8px 8px 16px rgba(0,0,0,0.55), -6px -6px 14px rgba(255,255,255,0.03)',
        'neu-pressed': 'inset 6px 6px 12px rgba(0,0,0,0.5), inset -4px -4px 10px rgba(255,255,255,0.03)',
      },
    },
  },
  plugins: [],
} satisfies Config
