import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, 'client/src/'),
      '@': path.resolve(__dirname, 'client/src'),
      '@shared/': path.resolve(__dirname, 'shared/'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./client/src/__tests__/setup.ts'],
    include: ['client/src/**/*.test.{ts,tsx}'],
    css: true,
  },
});
