import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

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
    rolldownOptions: {
      input: {
        popup: 'src/popup.html',
        sidepanel: 'src/sidepanel.html',
        analytics: 'src/analytics.html',
        content: 'src/content/index.ts'
      },
      output: {
        // Keep original names for better debugging
        keepNames: true
      }
    },
    // Generate source maps for debugging
    sourcemap: true,
    // Use the Oxc minifier (Vite's default; esbuild is no longer installed)
    minify: 'oxc'
  },
  // Resolve configuration for better module resolution
  resolve: {
    alias: {
      // Add alias for content script modules if needed
      '@content': '/src/content'
    }
  }
});
