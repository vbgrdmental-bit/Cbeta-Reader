import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5188,
    strictPort: false,
    host: true,
    proxy: {
      '/api-cbeta': {
        target: 'https://cbdata.dila.edu.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-cbeta/, '')
      }
    }
  }
})
