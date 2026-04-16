import { mergeConfig, defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/visual/**/*.test.ts'],
      exclude: ['**/dist/**', '**/node_modules/**'],
      environment: 'node',
      browser: {
        enabled: process.env.VITEST_BROWSER === '1',
        provider: playwright(),
        headless: true,
        instances: [{ browser: 'chromium' }],
      },
      fileParallelism: false,
      sequence: {
        concurrent: false,
      },
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  }),
);
