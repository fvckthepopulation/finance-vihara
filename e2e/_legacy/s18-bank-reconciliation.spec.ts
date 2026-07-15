/**
 * S-18: Rekonsiliasi bank — match transaksi sistem dengan rekening koran.
 * Pattern: buka buku besar rekening, mark beberapa baris sebagai 'cocok'.
 */
import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

test.describe("S-18: Bank Reconciliation", () => {
  test("approver opens 104-01 bankbook and reconciles a row", async ({ page }) => {
    await login(page, "approver");

    await page.goto("/cash");
    // Click first available bank account link to bankbook. Scope to main content —
    // the sidebar now has a "Jurnal & Buku Besar" nav link that would match first.
    await page.locator("main").locator('a:has-text("Buku besar")').first().click();
    await page.waitForURL(/\/cash\/.+/);

    // If there are rows, toggle reconciliation on the first one
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    if (count === 0) {
      test.skip(true, "No transactions in selected bankbook for the default period.");
    }

    const first = checkboxes.first();
    const wasChecked = await first.isChecked();
    await first.click();
    await page.waitForTimeout(500); // allow async update

    // Verify state flipped
    const nowChecked = await first.isChecked();
    expect(nowChecked).toBe(!wasChecked);
  });
});
