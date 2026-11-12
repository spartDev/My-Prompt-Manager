// PROTOTYPE, throwaway: serves src/prototype/new-button.html without the extension plugin,
// on its own port so it runs beside `npm run dev`.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5183, strictPort: true }
});
