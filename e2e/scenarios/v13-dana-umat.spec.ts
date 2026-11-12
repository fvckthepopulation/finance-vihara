/**
 * v13 — Penerimaan Dana Umat (/dana).
 * Yang diuji: 4 tab dana render dengan sub-line jumlah transaksi/nominal;
 * penerimaan baru (Dana Paramita) menambah total di tab Dana Paramita.
 */
import { test, expect } from "@playwright/test";
import { apiToken, login, pickViharaVVG, parseRp, viharaIdsByCode } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

const TABS = ["Dana Perayaan", "Dana Operasional", "Dana Bhikkhu", "Dana Paramita"];

test.describe("v13 dana umat", () => {
  let viharaVvg = 0;

  test.beforeAll(async () => {
    await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
  });

  test("4 tab dana render dengan badge transaksi", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/dana");

    for (const tab of TABS) {
      const btn = page.getByRole("button", { name: new RegExp(tab) });
      await expect(btn.first()).toBeVisible({ timeout: 10_000 });
      await expect(btn.first()).toContainText(/transaksi/);
    }
    await expect(page.getByText("Total Penerimaan").first()).toBeVisible();
    await expect(page.getByText("Jumlah Transaksi").first()).toBeVisible();
  });

  test("penerimaan Dana Paramita menambah total tab", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);

    // Baca total awal tab Dana Paramita.
    await page.goto("/dana");
    const tab = page.getByRole("button", { name: /Dana Paramita/ }).first();
    await expect(tab).toBeVisible({ timeout: 10_000 });
    await expect(tab).toContainText(/Rp/);
    const before = parseRp((await tab.innerText()).split("|").pop() ?? "");

    // Buat penerimaan Dana Paramita 77.000.
    await page.goto("/penerimaan");
    // Vihara transaksi kini dipilih di form, bukan diwarisi dari header.
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));
    await page.getByLabel("Jumlah (Rp) *").fill("77000");
    await selectByLabelRegex(page.getByLabel("Kategori Dana *"), /Dana Paramita/);
    await selectByLabelRegex(page.getByLabel("Nama Penerimaan *"), /Dhammasakacca/);
    await page.getByLabel("Catatan").fill(uniq("E2E-DANA"));
    await page.getByRole("button", { name: "Simpan Penerimaan" }).click();
    await expect(page.getByText("Penerimaan berhasil disimpan")).toBeVisible({ timeout: 10_000 });

    // Reload /dana → total tab bertambah 77.000.
    await page.goto("/dana");
    const tabAfter = page.getByRole("button", { name: /Dana Paramita/ }).first();
    await expect(tabAfter).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => parseRp((await tabAfter.innerText()).split("|").pop() ?? ""), {
        timeout: 10_000,
      })
      .toBe(before + 77_000);
  });
});
