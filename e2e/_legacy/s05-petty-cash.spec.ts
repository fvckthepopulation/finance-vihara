/**
 * S-05: Petty cash — deklarasi pengeluaran harian di kantor pusat.
 */
import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";
import { today } from "../fixtures/uniq";
import { selectByLabelRegex, waitForOptions } from "../fixtures/select";

test.describe("S-05: Petty Cash flow", () => {
  test("input creates expense, approver posts", async ({ page }) => {
    await login(page, "input");
    await page.goto("/petty-cash/new");

    const selects = page.locator("select");
    await waitForOptions(selects.nth(0));
    await selects.nth(0).selectOption({ index: 1 }); // entity

    // Counterpart (4th select, index 3) = expense account when type=expense.
    // Wait until options populated then pick a 7xx expense account.
    const counterpart = selects.nth(3);
    await selectByLabelRegex(counterpart, /7\d{2}-/);

    await page.locator('input[type="date"]').first().fill(today());
    await page.locator('input[inputmode="numeric"]').fill("100000");

    await page.getByPlaceholder(/ATK, konsumsi/i).fill("Konsumsi e2e test");
    await page.getByPlaceholder(/Nama orang\/toko/i).fill("Warung Tegal");

    await expect(page.getByText(/Preview jurnal/i)).toBeVisible();

    await page.getByRole("button", { name: /Simpan sebagai Draft/i }).click();
    // New movement redirects to /petty-cash?highlight=<id> — capture that id so
    // the approver opens THIS draft, not whatever happens to be first in the list
    // (the DB carries state across runs).
    await page.waitForURL(/\/petty-cash\?highlight=\d+/);
    const movementId = new URL(page.url()).searchParams.get("highlight");
    expect(movementId).toBeTruthy();

    // Input submits the draft for approval (two-person workflow: the approver
    // lacks petty_cash.create and cannot submit).
    await page.goto(`/petty-cash/${movementId}`);
    await page.getByRole("button", { name: /Submit untuk Approval/i }).click();
    // Submit succeeded once the draft-only action disappears (state → submitted).
    await expect(
      page.getByRole("button", { name: /Submit untuk Approval/i }),
    ).toBeHidden({ timeout: 10_000 });

    // Step 2: approver approves & posts
    await page.goto("/login");
    await login(page, "approver");
    await page.goto(`/petty-cash/${movementId}`);
    await page.waitForURL(/\/petty-cash\/\d+$/);

    await page.getByRole("button", { name: /Approve & Post/i }).click();
    // Status badge — scope to .inline-flex pills to avoid matching "Posted by" / "Posted at" labels
    await expect(
      page.locator("span.inline-flex").filter({ hasText: /^Posted$/ }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
