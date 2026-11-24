import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

/**
 * Cấu hình Playwright E2E cho kiểm duyệt tính năng AI Review & Roadmap.
 *
 * Yêu cầu trước khi chạy:
 * 1. PostgreSQL & Redis đang chạy (`docker compose up -d postgres redis`).
 * 2. Backend API chạy ở cổng 4000 với module AI Review bật:
 *    AI_REVIEW_ENABLED=true \
 *    AI_REVIEW_DATABASE_URL="postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=5" \
 *    AI_REVIEW_LLM_PROVIDER=fake \
 *    AI_REVIEW_LLM_MODEL=fake-v1 \
 *    npm run dev:api
 * 3. Frontend Vite chạy ở cổng 5173 (`npm run dev`).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // Chạy tuần tự vì các kịch bản dùng chung tài khoản demo seed trong DB
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
