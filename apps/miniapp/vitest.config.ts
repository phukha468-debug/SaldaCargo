import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/__tests__/**/*.test.ts', 'lib/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, '.') },
      {
        find: '@saldacargo/shared/api-handler',
        replacement: path.resolve(__dirname, '../../packages/shared/src/apiHandler.ts'),
      },
      {
        find: '@saldacargo/shared/session',
        replacement: path.resolve(__dirname, '../../packages/shared/src/session.ts'),
      },
      {
        find: '@saldacargo/shared/logger',
        replacement: path.resolve(__dirname, '../../packages/shared/src/logger.ts'),
      },
      {
        find: '@saldacargo/shared',
        replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
      {
        find: '@saldacargo/shared-types',
        replacement: path.resolve(__dirname, '../../packages/types/src/index.ts'),
      },
      {
        find: '@saldacargo/domain-service',
        replacement: path.resolve(__dirname, '../../packages/service/src/index.ts'),
      },
    ],
  },
});
