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

        // Vigil module palette — the light warm counterpart to Kindle's dark one.
        vigilBase: 'var(--vigil-bg-base)',
        vigilSurface: 'var(--vigil-bg-surface)',
        vigilGold: 'var(--vigil-gold)',
        vigilGoldSoft: 'var(--vigil-gold-soft)',
        vigilBronze: 'var(--vigil-bronze)',
        vigilInk: 'var(--vigil-ink)',
        vigilInkSoft: 'var(--vigil-ink-soft)',
        vigilLine: 'var(--vigil-line)',

        // Loom module palette — gunmetal + gold + burgundy.
        loomBase: 'var(--loom-bg-base)',
        loomSurface: 'var(--loom-bg-surface)',
        loomGold: 'var(--loom-gold)',
        loomBurgundy: 'var(--loom-burgundy)',
        loomBurgundySoft: 'var(--loom-burgundy-soft)',
        loomInk: 'var(--loom-ink)',
        loomMuted: 'var(--loom-muted)',
        loomLine: 'var(--loom-line)',

        // Virtus module palette — marble, bronze and ember red.
        marbleBase: 'var(--marble-base)',
        marbleSurface: 'var(--marble-surface)',
        marbleShadow: 'var(--marble-shadow)',
        bronze: 'var(--bronze-primary)',
        bronzeDeep: 'var(--bronze-deep)',
        ember: 'var(--ember-red)',
        inkCharcoal: 'var(--ink-charcoal)',
        inkSoft: 'var(--ink-soft)',
        virtusLine: 'var(--virtus-line)',
        virtusRest: 'var(--virtus-rest)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        inscribe: ['Cinzel', 'Georgia', 'serif'],
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
