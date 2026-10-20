import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const BASE = `http://localhost:${PORT}`;

/**
 * End-to-end tests run the production build against the TEST database.
 * Run `npm run build` first, then `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: BASE, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: BASE,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      BETTER_AUTH_URL: BASE,
      NEXT_PUBLIC_SITE_URL: BASE,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-secret-e2e-secret-e2e-secret-1234",
    },
  },
});
