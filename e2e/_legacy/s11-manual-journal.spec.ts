/**
 * S-11: Transfer antar rekening + koreksi jurnal manual.
 */
import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";
import { today, uniq } from "../fixtures/uniq";
import { selectByLabelRegex, waitForOptions } from "../fixtures/select";

test.describe("S-11: Manual journal — koreksi", () => {
  const description = `Koreksi e2e ${uniq("JE")}`;

  test("input creates balanced manual journal, approver posts", async ({ page }) => {
    await login(page, "input");
    await page.goto("/journal-entries/new");

    const entitySelect = page.locator("select").first();
    await waitForOptions(entitySelect);
    await entitySelect.selectOption({ index: 1 });
    await page.locator('input[type="date"]').first().fill(today());
    await page.getByPlaceholder(/Misal: Koreksi rekening/i).fill(description);

    const lineRows = page.locator("tbody tr");
    const line1 = lineRows.nth(0);
    await selectByLabelRegex(line1.locator("select"), /104-01/);
    await line1.locator('input[inputmode="numeric"]').first().fill("50000");

    const line2 = lineRows.nth(1);
    await selectByLabelRegex(line2.locator("select"), /401-00/);
    await line2.locator('input[inputmode="numeric"]').nth(1).fill("50000");

    await expect(page.getByText(/✓ Balanced/)).toBeVisible();

    await page.getByRole("button", { name: /Simpan sebagai Draft/i }).click();
    await page.waitForURL(/\/journal-entries\/\d+$/);

    await expect(
      page.locator("span.inline-flex").filter({ hasText: /^Draft$/ }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: /Submit untuk Approval/i }).click();
    await expect(page.getByText(/Menunggu Approval/i)).toBeVisible({ timeout: 10_000 });

    const url = page.url();
    await page.goto("/login");
    await login(page, "approver");
    await page.goto(url);

    await page.getByRole("button", { name: /Approve & Post/i }).click();
    // Match the status badge (pill) exactly, not the "Posted at"/"Posted by" labels
    await expect(
      page.locator("span.inline-flex").filter({ hasText: /^Posted$/ }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("imbalanced journal cannot be saved", async ({ page }) => {
    await login(page, "input");
    await page.goto("/journal-entries/new");

    const entitySelect = page.locator("select").first();
    await waitForOptions(entitySelect);
    await entitySelect.selectOption({ index: 1 });
    await page.locator('input[type="date"]').first().fill(today());
    await page.getByPlaceholder(/Misal: Koreksi rekening/i).fill("Test imbalanced");

    const lineRows = page.locator("tbody tr");
    await selectByLabelRegex(lineRows.nth(0).locator("select"), /104-01/);
    await lineRows.nth(0).locator('input[inputmode="numeric"]').first().fill("100");

    await selectByLabelRegex(lineRows.nth(1).locator("select"), /401-00/);
    await lineRows.nth(1).locator('input[inputmode="numeric"]').nth(1).fill("50");

    await expect(page.getByText(/Off Rp/i)).toBeVisible();

    const submitBtn = page.getByRole("button", { name: /Simpan sebagai Draft/i });
    await expect(submitBtn).toBeDisabled();
  });
});
