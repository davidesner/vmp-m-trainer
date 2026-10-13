import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#86c441', dark: '#6ba830', light: '#eef9e1' },
        danger:  { DEFAULT: '#e74c3c', light: '#fdecea' },
        accent:  { DEFAULT: '#5a6cdb' },
        river:   { DEFAULT: '#123f4c', deep: '#0b2b35', wave: '#103945', mist: '#e6eff1', line: '#c9dadf' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
} satisfies Config
