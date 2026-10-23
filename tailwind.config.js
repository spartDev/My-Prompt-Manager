/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/*.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [
    function({ addComponents }) {
      addComponents({
        // Focus rings: a 2px accent outline, offset by a transparent gap that shows the surface behind
        '.focus-primary': {
          '@apply focus:outline-2 focus:outline-offset-2 focus:outline-accent': {},
        },
        '.focus-secondary': {
          '@apply focus:outline-2 focus:outline-offset-1 focus:outline-accent': {},
        },
        '.focus-danger': {
          '@apply focus:outline-2 focus:outline-offset-2 focus:outline-danger': {},
        },
        // Fields: the ring hugs the field and its border takes the same accent
        '.focus-input': {
          '@apply focus:outline-none focus:ring-2 focus:ring-accent focus:border-focus': {},
        },
        // Interactive element base focus
        '.focus-interactive': {
          '@apply focus:outline-2 focus:outline-offset-1 focus:outline-accent': {},
        }
      })
    }
  ],
}