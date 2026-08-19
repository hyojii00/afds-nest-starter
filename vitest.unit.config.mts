import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@afds-nest-starter/ordering': `${root}packages/ordering/src/index.ts`,
      '@afds-nest-starter/platform': `${root}packages/platform/src/index.ts`,
    },
  },
  test: {
    environment: 'node',
    include: ['apps/**/*.spec.ts', 'packages/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.e2e-spec.ts', '**/*.integration-spec.ts'],
  },
});
