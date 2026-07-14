import { defineConfig, devices } from "@playwright/test";

/**
 * cardia-survey e2e: 移动端布局回归.
 * 前提: 本地静态服务器已在 http://192.168.5.94:4173 运行
 *   (python3 -m http.server 4173 --bind 0.0.0.0 于仓库目录)
 * 运行: bun run test   (或 npx playwright test)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://192.168.5.94:4173",
    headless: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
