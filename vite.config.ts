import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  },
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup.html',
        sidepanel: 'src/sidepanel.html',
        analytics: 'src/analytics.html',
        content: 'src/content/index.ts'
      }
    },
    // Generate source maps for debugging
    sourcemap: true,
    // Use esbuild for minification (faster and included by default)
    minify: 'esbuild'
  },
  // Ensure TypeScript is properly configured
  esbuild: {
    // Keep original names for better debugging
    keepNames: true,
    // Generate source maps
    sourcemap: true
  },
  // Resolve configuration for better module resolution
  resolve: {
    alias: {
      // Add alias for content script modules if needed
      '@content': '/src/content'
    }
  }
});