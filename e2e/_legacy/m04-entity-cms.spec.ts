/**
 * Master Entity CMS (F1.2) — admin can list, edit; cannot delete in-use entities.
 */
import { test, expect, Page, Locator } from "@playwright/test";
import { login } from "../fixtures/auth";

/**
 * Scope to a single entity Card. Each card is a `rounded-xl bg-km-panel` div
 * wrapping its <h3> code; matching both classes isolates one card. (Plain `div`
 * matches every ancestor that holds all four cards, and `.rounded-xl` alone also
 * matches the AppShell wrapper — neither narrows to a single card.)
 */
function entityCard(page: Page, code: string): Locator {
  return page
    .locator("div.rounded-xl.bg-km-panel")
    .filter({ has: page.locator("h3").filter({ hasText: new RegExp(`^${code}$`) }) });
}

test.describe("Master Entity CMS", () => {
  test("admin can view 4 entities with usage breakdown", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/entities");

    await expect(page.getByText(/Master Entitas/i).first()).toBeVisible();

    // Should render at least 4 cards (PGS / GMP / DS / GFS). Entities load async,
    // so poll rather than reading count() once.
    const cards = page.locator("h3").filter({ hasText: /^(PGS|GMP|DS|GFS)$/ });
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(4);

    // Usage breakdown grid renders stat boxes inside each entity card
    const pgsCard = entityCard(page, "PGS");
    await expect(pgsCard.getByText(/AP Inv/i)).toBeVisible();
    await expect(pgsCard.getByText(/AR Inv/i)).toBeVisible();
  });

  test("cannot delete in-use entity PGS", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/entities");

    const pgsCard = entityCard(page, "PGS");
    page.once("dialog", (d) => d.accept());
    await pgsCard.getByRole("button", { name: /Hapus/i }).click();

    await expect(
      page.getByText(/tidak bisa dihapus karena|dipakai di/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("admin edits entity legal_name + npwp", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/entities");

    await entityCard(page, "GFS").getByRole("button", { name: /Edit/i }).click();

    const npwpField = page.getByLabel(/^NPWP$/);
    await npwpField.fill("01.234.567.8-901.000");

    await page.getByRole("button", { name: /^Simpan$/i }).click();

    // Verify NPWP is now displayed in the GFS card
    await expect(
      entityCard(page, "GFS").getByText(/01\.234\.567/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
