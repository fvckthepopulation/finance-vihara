/**
 * Master COA CMS (F1.1) — admin can create custom account, edit, delete unused.
 * In-use account cannot be deleted; in-use account cannot have type changed without force.
 */
import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";
import { uniq } from "../fixtures/uniq";

test.describe("Master COA CMS", () => {
  const code = `9${Math.floor(Math.random() * 90 + 10)}-${Math.floor(Math.random() * 90 + 10)}`;
  const name = `Test ${uniq("ACC")}`;

  test("admin creates + edits + deletes custom account", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/coa");

    // Wait for the table to populate
    await expect(page.getByText(/Master COA/i).first()).toBeVisible();

    // === Create ===
    await page.getByRole("button", { name: /\+ Akun baru/i }).click();

    await page.getByPlaceholder("500-99").fill(code);
    await page.getByLabel(/Nama akun/i).fill(name);
    // Type stays at "asset" (default)

    await page.getByRole("button", { name: /^Simpan$/i }).click();

    // Modal closes on success. Let the post-save reload settle before searching,
    // otherwise its (unfiltered) fetch races the search fetch and can win.
    await expect(page.getByRole("heading", { name: "Akun baru" })).toBeHidden({
      timeout: 10_000,
    });
    await page.waitForLoadState("networkidle");

    // The COA list is paginated (25/page, sorted by code); a custom 9xx account
    // lands on a later page, so search to bring it into view.
    await page.getByPlaceholder(/Cari kode atau nama/i).fill(code);
    await expect(page.locator("td").filter({ hasText: code }).first()).toBeVisible({
      timeout: 10_000,
    });

    // === Edit name ===
    const row = page.locator("tr").filter({ hasText: code });
    await row.getByRole("button", { name: /Edit/i }).click();

    const newName = `${name} EDITED`;
    await page.getByLabel(/Nama akun/i).fill(newName);
    await page.getByRole("button", { name: /^Simpan$/i }).click();

    await expect(page.locator("td").filter({ hasText: newName }).first()).toBeVisible({
      timeout: 10_000,
    });

    // === Delete (unused, must succeed) ===
    page.once("dialog", (d) => d.accept());
    const newRow = page.locator("tr").filter({ hasText: code });
    await newRow.getByRole("button", { name: /Hapus/i }).click();
    await expect(page.locator("td").filter({ hasText: code })).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test("admin cannot delete in-use account (401-00)", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/coa");

    // List is paginated — search to surface 401-00 (it isn't on page 1).
    await page.getByPlaceholder(/Cari kode atau nama/i).fill("401-00");

    // 401-00 Hutang Usaha is heavily used
    const inUseRow = page.locator("tr").filter({ hasText: "401-00" }).first();
    await expect(inUseRow).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await inUseRow.getByRole("button", { name: /Hapus/i }).click();

    // Error banner should appear
    await expect(
      page.getByText(/tidak bisa dihapus karena|dipakai di/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
