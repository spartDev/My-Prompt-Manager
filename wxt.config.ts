import { defineConfig } from 'wxt';

export default defineConfig({
  // Source directory - all application code lives in src/
  srcDir: 'src',

  // Use WXT React module for automatic React setup
  modules: ['@wxt-dev/module-react'],

  // Use Chrome extension API (WXT provides browser wrapper for cross-browser compatibility)
  extensionApi: 'chrome',

  // Enable auto-imports for React hooks and browser APIs
  imports: {
    presets: ['react'],
    addons: {
      vueTemplate: false,
    },
  },

  // Manifest configuration (converted from manifest.json)
  manifest: {
    name: 'My Prompt Manager',
    version: '1.7.0',
    description: 'Personal prompt library for AI platforms. Store, organize, and instantly insert your best prompts with one click.',
    author: 'Thomas Roux',
    homepage_url: 'https://github.com/spartDev/My-Prompt-Manager',

    permissions: [
      'storage',
      'activeTab',
      'tabs',
      'sidePanel',
      'scripting',
    ],

    host_permissions: [
      'https://claude.ai/*',
      'https://chatgpt.com/*',
      'https://gemini.google.com/*',
      'https://www.perplexity.ai/*',
      'https://chat.mistral.ai/*',
    ],

    optional_host_permissions: [
      'https://*/*',
      'http://*/*',
    ],

    action: {
      default_title: 'My Prompt Manager - Manage your prompts',
    },

    side_panel: {
      default_path: '/sidepanel.html',
    },

    icons: {
      16: '/icons/icon-16.png',
      32: '/icons/icon-32.png',
      48: '/icons/icon-48.png',
      128: '/icons/icon-128.png',
    },

    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },

    short_name: 'My Prompt Manager',
    minimum_chrome_version: '114',

    // Web accessible resources for dynamic content script loading
    web_accessible_resources: [
      {
        matches: ['https://*/*', 'http://*/*'],
        resources: [
          'content-scripts/*.js',
          'chunks/*.js',
        ],
        use_dynamic_url: false,
      },
    ],
  },

  // Vite configuration (migrated from vite.config.ts)
  vite: () => ({
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173,
      },
    },

    build: {
      sourcemap: true,
      minify: 'esbuild',
    },

    esbuild: {
      keepNames: true,
      sourcemap: true,
    },

    resolve: {
      alias: {
        '@': '/src',
        '@content': '/src/content',
        '@components': '/src/components',
        '@hooks': '/src/hooks',
        '@services': '/src/services',
        '@contexts': '/src/contexts',
        '@types': '/src/types',
        '@utils': '/src/utils',
        '@config': '/src/config',
      },
    },
  }),
});
