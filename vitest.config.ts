import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    watch: false,
    globals: true,
    css: true,
    exclude: [
      ...configDefaults.exclude,
      'tests/e2e/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 50
      },
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'dist/',
        'tests/e2e/**',
        'package-extension.cjs',
        'tailwind.config.js',
        'postcss.config.js',
        'vite.config.ts',
        'vitest.config.ts',
        '**/index.ts',
        'src/types/**',
        'src/background/**',
        '*.config.*'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});