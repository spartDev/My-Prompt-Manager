/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/*.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    },
  },
  plugins: [
    function({ addComponents }) {
      addComponents({
        // Standard focus states for different button types
        '.focus-primary': {
          '@apply focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2': {},
        },
        '.focus-secondary': {
          '@apply focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1': {},
        },
        '.focus-danger': {
          '@apply focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2': {},
        },
        '.focus-input': {
          '@apply focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500': {},
        },
        // Interactive element base focus
        '.focus-interactive': {
          '@apply focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1': {},
        }
      })
    }
  ],
}