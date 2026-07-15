/**
 * K-00: Smoke — login UI + dashboard renders for every seeded role.
 *
 * Sanity check sebelum suite lain jalan: 4 seeded user bisa login dan
 * landing di /dashboard tanpa runtime error. Plus negative test untuk
 * kredensial salah.
 *
 * Env:
 *   E2E_BASE_URL  — Next.js web (default http://localhost:3500)
 */
import { test, expect } from "@playwright/test";
import { login, USERS, UserKey } from "../fixtures/auth";

const USERS_TO_CHECK: UserKey[] = ["admin", "ops", "approver", "viewer"];

test.describe("K-00: Smoke — login + dashboard render", () => {
  for (const userKey of USERS_TO_CHECK) {
    test(`${userKey} (${USERS[userKey].email}) bisa login → dashboard`, async ({ page }) => {
      await login(page, userKey);
      await expect(page.locator("body")).not.toHaveText(/uncaught|stack trace/i);
      await expect(page).toHaveURL(/\/dashboard/);
    });
  }

  test("login dengan kredensial salah → stay di /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@vihara.test");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/login/);
  });
});
