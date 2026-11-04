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
            DEFAULT: '#6B1D2F',
            dark: '#540000',
            deep: '#3B0000',
            light: '#85243B',
            50: '#FDF2F4',
            100: '#FBE8EC',
            200: '#F6D2D9',
            500: '#6B1D2F',
            700: '#540000',
            900: '#3B0000',
          },
          gold: {
            DEFAULT: '#D4AF37',
            light: '#E6C65C',
            dark: '#B08D23',
            50: '#FDFBF4',
            100: '#FAF5E3',
            500: '#D4AF37',
            700: '#B08D23',
          },
          surface: {
            bg: '#F9FAFB',
            card: '#FFFFFF',
            border: '#E5E7EB',
            hover: '#F3F4F6',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

