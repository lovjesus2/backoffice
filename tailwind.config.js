/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#2a69ac',
          600: '#1e5085'
        }
      }
    },
  },
  plugins: [],
}