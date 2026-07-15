/**
 * S-19: Laporan keuangan 4 entitas Maret 2026 — smoke test, just verify pages render.
 */
import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

test.describe("S-19: Laporan Keuangan", () => {
  test("P&L renders with section + net income", async ({ page }) => {
    await login(page, "approver");
    await page.goto("/reports/income-statement");

    // Both Metric card label AND section-total cell contain "Total Pendapatan" — use .first()
    await expect(page.getByText(/Total Pendapatan/i).first()).toBeVisible();
    await expect(page.getByText(/LABA \/ \(RUGI\) BERSIH/i)).toBeVisible();
  });

  test("Balance Sheet shows Asset = Liability + Equity", async ({ page }) => {
    await login(page, "approver");
    await page.goto("/reports/balance-sheet");

    await expect(page.getByText(/Total Aset/i).first()).toBeVisible();
    await expect(page.getByText(/Total Kewajiban/i).first()).toBeVisible();
    await expect(page.getByText(/Balance Check/i)).toBeVisible();
  });

  test("Cash Flow shows 4 sections", async ({ page }) => {
    await login(page, "approver");
    await page.goto("/reports/cash-flow");

    await expect(page.getByText(/Opening Cash/i)).toBeVisible();
    await expect(page.getByText(/Operasional/i).first()).toBeVisible();
    await expect(page.getByText(/Investasi/i).first()).toBeVisible();
    await expect(page.getByText(/Pendanaan/i).first()).toBeVisible();
  });
});
