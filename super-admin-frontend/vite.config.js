import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/super-admin/',
  server: {
    port: 3001,
    host: '0.0.0.0',
    // Enable history API fallback for SPA routing
    historyApiFallback: true,
  },
  preview: {
    port: 3001,
    host: '0.0.0.0',
  },
})
