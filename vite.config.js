import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        threejs: resolve(__dirname, 'src/threejs-demo/index.html'),
        video: resolve(__dirname, 'src/video-demo/index.html'),
      },
    },
  },
});
