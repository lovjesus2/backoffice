import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
export default {
  plugins: [sveltekit()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    allowedHosts: 'all'
  },
  // 이 부분 추가
  define: {
    'process.env.BODY_SIZE_LIMIT': '"50mb"'
  }
};
