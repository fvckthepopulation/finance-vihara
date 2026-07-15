import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/scenarios",
  // Note: e2e/_legacy/ contains HomeMade-era scenarios that don't apply to
  // KalyanaMitta marketplace. Scoping testDir to /scenarios excludes them. To run a
  // legacy one for reference, move it back to /scenarios temporarily.
  fullyParallel: false, // shared DB state between tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // single worker — sequential to avoid DB collisions
  // Selalu tulis JSON ke test-results/results.json → dipakai generator laporan
  // Excel (npm run test:e2e:report). Reporter konsol tetap list/github.
  reporter: [
    [process.env.CI ? "github" : "list"],
    ["json", { outputFile: "test-results/results.json" }],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3500",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Comment out webServer if you prefer to start services manually
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: true,
  //   timeout: 60_000,
  // },
});
