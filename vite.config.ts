import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  worker: {
    format: 'es'
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
      '@flux': resolve(__dirname, './src/types/domain.ts'),
    }
  },
  assetsInclude: ['**/*.ttf'],
  optimizeDeps: {
    include: ['flux-game'],
    force: true
  },
  define: {
    global: 'globalThis',
  }
})
