import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    // P1-1 拆 three chunk (~600KB) 独立出去, 主 bundle 只留 App 逻辑 + react, 可长期缓存
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'three/addons/loaders/GLTFLoader.js'],
        },
      },
    },
    // three 单独 chunk 约 600KB, 主 bundle 应 <200KB
    chunkSizeWarningLimit: 700,
  },
});
