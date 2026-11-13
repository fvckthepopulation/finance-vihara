/**
 * v21 — Kas Kecil (/petty-cash).
 * Yang diuji (VVG): kartu ringkasan PIC Lili & Epi; Pengisian kas kecil
 * menaikkan "Saldo Saat Ini" Epi sebesar nominal; Penggunaan menurunkannya;
 * filter PIC Lili di riwayat hanya menampilkan baris Lili.
 */
import { test, expect, Page, Locator } from "@playwright/test";
import { apiToken, login, pickViharaVVG, parseRp, viharaIdsByCode } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

function picCard(page: Page, name: string): Locator {
  return page
    .locator("div.rounded-xl")
    .filter({ hasText: `Kas Kecil — ${name}` })
    .filter({ has: page.getByText("Saldo Saat Ini") })
    .last();
}

async function readSaldo(page: Page, name: string): Promise<number> {
  const card = picCard(page, name);
  await expect(card).toBeVisible({ timeout: 15_000 });
  const value = card.getByText("Saldo Saat Ini", { exact: true }).locator("xpath=following-sibling::p");
  return parseRp(await value.innerText());
}

test.describe("v21 kas kecil", () => {
  let viharaVvg = 0;

  test.beforeAll(async () => {
    await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
  });

  test("kartu ringkasan Lili & Epi tampil", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/petty-cash");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    await expect(picCard(page, "Lili")).toBeVisible({ timeout: 15_000 });
    await expect(picCard(page, "Epi")).toBeVisible();
    await expect(picCard(page, "Epi").getByText("Saldo Awal")).toBeVisible();
  });

  test("pengisian Epi 111.000 dari Dana Tunai → saldo naik", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/petty-cash");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    const before = await readSaldo(page, "Epi");

    const form = page.locator("form").filter({ hasText: "Pengisian Kas Kecil" });
    await selectByLabelRegex(form.getByLabel("PIC Kas Kecil"), /Epi/);
    await form.getByLabel("Jumlah Pengisian (Rp)").fill("111000");
    await selectByLabelRegex(form.getByLabel("Ambil dari"), /Dana Tunai/);
    await form.getByLabel("Catatan").fill(uniq("E2E-ISI"));
    await form.getByRole("button", { name: "Catat Pengisian" }).click();

    // Toast sukses (pesan longgar — komponen Toast yang sama).
    await expect(page.getByText(/tercatat/i).first()).toBeVisible({ timeout: 10_000 });

    // Riwayat memuat baris Pengisian.
    await expect(
      page.locator("tr", { hasText: "Pengisian" }).filter({ hasText: "Epi" }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Reload → saldo Epi bertambah 111.000.
    await page.reload();
    await expect.poll(() => readSaldo(page, "Epi"), { timeout: 15_000 }).toBe(before + 111_000);
  });

  test("penggunaan Epi 11.000 → saldo turun", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/petty-cash");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    const before = await readSaldo(page, "Epi");

    const form = page.locator("form").filter({ hasText: "Penggunaan Kas Kecil" });
    await selectByLabelRegex(form.getByLabel("PIC Kas Kecil"), /Epi/);
    await form.getByLabel("Keperluan").fill(uniq("E2E-PAKAI"));
    await form.getByLabel("Jumlah (Rp)").fill("11000");
    await form.getByLabel("No. Bukti / Kuitansi").fill(uniq("KWT"));
    await form.getByRole("button", { name: "Catat Penggunaan" }).click();

    await expect(page.getByText(/tercatat/i).first()).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect.poll(() => readSaldo(page, "Epi"), { timeout: 15_000 }).toBe(before - 11_000);
  });

  test("filter PIC Lili → hanya baris Lili", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/petty-cash");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    // Satu mutasi Lili dibuat lebih dulu. Tanpa ini pengujiannya hampa:
    // kalau Lili memang belum punya mutasi, saringan apa pun terlihat "benar".
    const form = page.locator("form").filter({ hasText: "Penggunaan Kas Kecil" });
    await selectByLabelRegex(form.getByLabel("PIC Kas Kecil"), /Lili/);
    await form.getByLabel("Keperluan").fill(uniq("E2E-LILI"));
    await form.getByLabel("Jumlah (Rp)").fill("9000");
    await form.getByLabel("No. Bukti / Kuitansi").fill(uniq("KWT-LILI"));
    await form.getByRole("button", { name: "Catat Penggunaan" }).click();
    await expect(page.getByText(/tercatat/i).first()).toBeVisible({ timeout: 10_000 });

    const filter = page.getByLabel("Filter PIC");
    await expect(filter).toBeVisible({ timeout: 15_000 });
    await selectByLabelRegex(filter, /Lili/);

    const rows = page.locator("tbody tr");
    await expect(rows.first()).toContainText("Lili", { timeout: 15_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await rows.nth(i).innerText();
      expect(text).toContain("Lili");
      expect(text).not.toContain("Epi");
    }
  });
});
