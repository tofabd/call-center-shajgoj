import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve('./src'),
      '@components': path.resolve('./src/components'),
      '@pages': path.resolve('./src/pages'),
      '@services': path.resolve('./src/services'),
      '@contexts': path.resolve('./src/contexts'),
      '@utils': path.resolve('./src/utils'),
      '@assets': path.resolve('./src/assets'),
    },
  }
})
