import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
      '@flux': resolve(__dirname, 'node_modules/flux-game/dist/index.js'),
    }
  },
  optimizeDeps: {
    include: ['flux-game'],
    force: true
  },
  define: {
    global: 'globalThis',
  }
})
