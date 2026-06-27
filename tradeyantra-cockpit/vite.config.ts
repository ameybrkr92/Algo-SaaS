import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Trading data comes from the OpenAlgo engine (:5000); the reasoning brain from
// the intelligence API (:6061). The dev server proxies both so the app talks to
// one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/auth': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/reasoning': { target: 'http://127.0.0.1:6061', changeOrigin: true },
      '/memory': { target: 'http://127.0.0.1:6061', changeOrigin: true },
      '/hypothesis': { target: 'http://127.0.0.1:6061', changeOrigin: true },
    },
  },
})
