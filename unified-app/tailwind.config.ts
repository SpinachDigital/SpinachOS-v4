import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        foreground: '#FAFAF7',
        muted: '#52525B',
        accent: '#4CAF50',
        border: '#E5E5E5',
        card: '#2D2D2D',
        dark: {
          100: '#1A1A2E',
          200: '#0A0A0A',
          300: '#0F0F0F',
          400: '#141414',
          500: '#1E1E1E',
        },
        spinach: {
          400: '#4CAF50',
          500: '#43A047',
          600: '#388E3C',
          700: '#2E7D32',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config