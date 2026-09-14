import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = process.env.VITE_DEV_BACKEND_URL || 'https://lango-market-pluse-4fje.onrender.com'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rolldownOptions: {
      output: {
        minify: {
          compress: {
            dropConsole: true,
            dropDebugger: true,
          },
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
