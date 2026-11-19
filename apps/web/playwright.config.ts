import { defineConfig, devices } from "@playwright/test";

// E2E tests run against the LOCAL Supabase stack (`npm run db:start` from the repo root) and
// read magic-link emails from Mailpit. See docs/adr/0009-local-first-development.md.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // tests share one Mailpit inbox
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
