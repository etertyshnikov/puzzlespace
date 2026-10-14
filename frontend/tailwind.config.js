/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: { 50: '#f0f4ff', 100: '#e0e9ff', 200: '#c7d6fe', 300: '#a4b8fc', 400: '#8093f8', 500: '#636cf5', 600: '#4f4eeb', 700: '#423ed0', 800: '#3734a9', 900: '#313386' },
      },
    },
  },
  plugins: [],
}
