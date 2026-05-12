// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E3A8A', // trust + platform core
        secondary: '#FFFFFF', // white
        dark: '#000000', // black
        'primary-dark': '#172554',
        'primary-light': '#7C3AED',
        intelligence: '#7C3AED', // AI layer
        'intelligence-dark': '#6D28D9',
      }
    },
  },
  plugins: [],
}
