import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/global-setup.ts",
  timeout: process.env.CI ? 90_000 : 45_000,
  workers: process.env.CI ? 2 : 1,
  expect: {
    timeout: 7_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "Mobile",
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
      },
    },
    {
      name: "Tablet",
      use: {
        ...devices["iPad (gen 7)"],
        browserName: "chromium",
      },
    },
    {
      name: "Desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: "pnpm exec next dev --webpack --hostname 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/login",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public",
      DIRECT_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public",
      SESSION_SECRET: "test-session-secret-change-before-production-32chars",
      SESSION_COOKIE_SECURE: "0",
      APP_VERSION: "1.0.0",
      ASSISTANT_PROVIDER: "mock",
      NEXT_PUBLIC_CONVEX_URL: "",
      CONVEX_DEPLOYMENT: "",
      NEXT_PUBLIC_FEATURE_COMMAND_PALETTE: "1",
      NEXT_PUBLIC_FEATURE_COMPONENTS_SHOWROOM: "1",
      NEXT_PUBLIC_FEATURE_REPORTS_PDF: "1",
      NEXT_PUBLIC_FEATURE_WINDOW_CONTROLS_OVERLAY: "0",
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GOOGLE_API_KEY: "",
      COHERE_API_KEY: "",
      OPENROUTER_API_KEY: "",
    },
  },
});
