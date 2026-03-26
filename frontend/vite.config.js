// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // When building, assets go into /app/ sub-path so Strapi can serve them
  // from /public/app/
  base: '/',

  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to Strapi in development
      '/api': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
      // Proxy Socket.IO handshake
      '/socket.io': {
        target: 'http://localhost:1337',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});


// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })
