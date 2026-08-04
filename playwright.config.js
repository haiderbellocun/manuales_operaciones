import { defineConfig } from '@playwright/test';
import path from 'path';

const e2eStorageDir = path.resolve('test-results', 'file-storage');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    },
  },
  webServer: [
    {
      command: 'node server/src/index.js',
      url: 'http://127.0.0.1:3100/api/health',
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        PORT: '3100',
        CORS_ORIGIN: 'http://127.0.0.1:5174',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: '1',
        SMTP_SECURE: 'false',
        SMTP_USER: 'e2e-no-send',
        SMTP_PASS: 'e2e-no-send',
        SMTP_FROM: 'Acervo E2E <e2e@localhost>',
        FILE_STORAGE_MODE: 'local',
        FILE_STORAGE_LOCAL_DIR: e2eStorageDir,
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        VITE_API_URL: 'http://127.0.0.1:3100/api',
      },
    },
  ],
});
