import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // o1js requires top-level await and modern syntax
  build: {
    target: 'esnext',
  },

  // Prevent Vite from pre-bundling o1js and our SDK (to avoid stale cache)
  optimizeDeps: {
    exclude: ['o1js', 'noah-mina'], // 'noah-mina' is the new package name
    esbuildOptions: {
      target: 'esnext',
    },
  },

  // o1js WASM workers need SharedArrayBuffer, which requires
  // cross-origin isolation headers (COOP + COEP)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  // Worker config for o1js
  worker: {
    format: 'es',
  },
})
