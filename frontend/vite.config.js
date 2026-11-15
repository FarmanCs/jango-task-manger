import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/static/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    assetsDir: 'assets',
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
}))
