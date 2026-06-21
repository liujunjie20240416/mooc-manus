import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: ['@novnc/novnc'],
  },
  esbuild: {
    target: 'esnext',
  },
  build: {
    target: 'esnext',
  },
  server: {
    port: 5174,
  },
})
