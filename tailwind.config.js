import { skeleton } from '@skeletonlabs/skeleton/tailwind/skeleton.cjs';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './node_modules/@skeletonlabs/skeleton/**/*.{html,js,svelte,ts}'
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
  plugins: [
    skeleton({
      themes: { preset: [ "skeleton" ] }
    }),
    require('@tailwindcss/forms')
  ],
}
