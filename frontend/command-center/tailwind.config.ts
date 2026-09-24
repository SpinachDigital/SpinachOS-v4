import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors from brand guide
        'spinach': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Teal accent
        'teal': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#004B63', // Primary teal
          600: '#003d4f',
          700: '#002f40',
          800: '#002232',
          900: '#001524',
        },
        // Warm neutrals (off-white base)
        'warm': {
          50: '#fafaf7', // Page background
          100: '#f5f5f0', // Panel background
          200: '#eeeee6', // Hover states
          300: '#d8d8ce',
          400: '#c2c2b8',
          500: '#a8a89e', // Placeholder text
          600: '#78786e', // Muted text
          700: '#40403a', // Secondary text
          800: '#20201e',
          900: '#0a0a0a', // Primary text (near-black)
        },
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 0 0 1px rgba(10, 10, 10, 0.06), 0 2px 4px rgba(10,10,10,0.04), 0 8px 16px -8px rgba(10,10,10,0.06), inset 0 1px 0 #ffffff',
        elevated: '0 0 0 1px rgba(10, 10, 10, 0.06), 0 4px 12px rgba(10,10,10,0.06), 0 16px 32px -16px rgba(10,10,10,0.08)',
        focus: '0 0 0 3px rgba(0, 75, 99, 0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class',
};

export default config;