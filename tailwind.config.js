/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kuk: {
          maroon: {
            DEFAULT: '#540000',
            deep: '#3B0000',
            dark: '#540000',
            light: '#6E0000',
            50: '#FDF2F2',
            100: '#FCE7E7',
            200: '#F7C5C5',
            500: '#6E0000',
            700: '#540000',
            800: '#400000',
            900: '#2E0000',
          },
          gold: {
            DEFAULT: '#FFCC00',
            main: '#FFCC00',
            dark: '#996414',
            light: '#FFE066',
            50: '#FFFDF0',
            100: '#FFF9D6',
            200: '#FFF2AD',
            500: '#FFCC00',
            700: '#996414',
            800: '#7A4F10',
            900: '#52340A',
          },
          grey: {
            light: '#E5E5E5',
            border: '#E5E5E5',
            50: '#F9FAFB',
            100: '#F3F4F6',
            200: '#E5E5E5',
            300: '#D1D5DB',
            400: '#9CA3AF',
            500: '#6B7280',
          },
          red: {
            DEFAULT: '#FF0000',
            dark: '#CC0000',
            light: '#FF4D4D',
            50: '#FEF2F2',
            100: '#FEE2E2',
          },
          surface: {
            bg: '#F8F9FA',
            card: '#FFFFFF',
            border: '#E5E5E5',
            hover: '#F4F5F7',
            dark: '#540000',
          }
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Revans', '"Plus Jakarta Sans"', 'sans-serif'],
        revans: ['Revans', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'brand': '0 4px 20px -2px rgba(84, 0, 0, 0.08), 0 2px 6px -1px rgba(84, 0, 0, 0.04)',
        'brand-gold': '0 4px 14px 0 rgba(255, 204, 0, 0.35)',
        'brand-card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
