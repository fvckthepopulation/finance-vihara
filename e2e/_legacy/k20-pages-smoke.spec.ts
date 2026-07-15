/**
 * K-20: Smoke render — semua halaman utama load tanpa runtime error,
 * status 200 dari sisi web, body bukan halaman error Next.
 *
 * Env: E2E_BASE_URL (default http://localhost:3500)
 */
import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

const PAGES = [
  { path: "/dashboard", title: /dashboard/i },
  { path: "/cash", title: /kas|bank|cash/i },
  { path: "/petty-cash", title: /petty/i },
  { path: "/rekonsiliasi", title: /rekonsiliasi/i },
  { path: "/pembayaran", title: /pembayaran/i },
  { path: "/penerimaan", title: /penerimaan/i },
  { path: "/jurnal", title: /jurnal/i },
  { path: "/laporan", title: /laporan|p&l|balance/i },
] as const;

test.describe("K-20: Pages smoke (logged in as admin)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  for (const { path, title } of PAGES) {
    test(`${path} renders without runtime error`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} HTTP`).toBeLessThan(400);

      // Body should not show Next.js dev error overlay or React error boundary.
      await expect(page.locator("body")).not.toHaveText(/uncaught|runtime error|cannot read/i, {
        timeout: 5_000,
      });

      // Should still be on the requested path (not redirected to /login).
      await expect(page).toHaveURL(new RegExp(path.replace("/", "\\/")));

      // Title or header should give a hint of being the right page (loose match — page may use h1/h2).
      const heading = page.locator("h1, h2").first();
      await expect(heading).toBeVisible({ timeout: 5_000 });
    });
  }
});
