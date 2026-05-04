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
      },
    },
  },
  plugins: [typography],
} satisfies Config
