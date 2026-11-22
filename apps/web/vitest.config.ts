import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['features/**/__tests__/**/*.test.ts', 'lib/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@saldacargo/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@saldacargo/shared-types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@saldacargo/domain-service': path.resolve(__dirname, '../../packages/service/src/index.ts'),
    },
  },
});
