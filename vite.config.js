import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
export default {
  plugins: [sveltekit()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    allowedHosts: 'all'
  }
};
