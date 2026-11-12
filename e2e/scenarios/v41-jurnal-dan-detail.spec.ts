/**
 * v41 — Keterbacaan Jurnal & detail pengeluaran (FV-15, FV-17, FV-18, FV-19).
 *
 * Empat laporan yang menyapu satu keluhan yang sama: data ada, tapi tidak
 * bisa ditelusuri. Jurnal tidak menyebut asal transaksinya, tanggalnya tampil
 * mentah, tombol detailnya terlalu kecil, dan pengeluaran yang sudah diinput
 * tidak punya tempat untuk dilihat ulang — termasuk lampiran buktinya, yang
 * justru dibutuhkan saat approval.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

type Dibuat = { id: number; code: string };

test.describe.configure({ mode: "serial" });

test.describe("v41 jurnal & detail", () => {
  let token = "";
  let viharaVvg = 0;
  let rekening = 0;
  let pengeluaranId = 0;
  let bukti = "";

  test.beforeAll(async () => {
    token = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
    const rek = await apiCall<{ data?: Array<{ id: number }> } | Array<{ id: number }>>(
      token,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}`,
    );
    const daftar = Array.isArray(rek.body) ? rek.body : (rek.body.data ?? []);
    rekening = daftar[0].id;
  });

  test("FV-15: daftar pengeluaran punya Detail, isinya lengkap, lampiran terbuka", async ({
    page,
  }) => {
    bukti = uniq("E2E-DET");
    await login(page, "admin");
    await page.goto("/pembayaran");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    await page.getByLabel("Jumlah (Rp) *").fill("88000");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await selectByLabelRegex(page.getByLabel("Nama Pengeluaran *"), /Biaya ATK/);
    await selectByLabelRegex(page.getByTestId("form-rekening"), /BCA/);
    await page.getByLabel("Dibayarkan kepada / PIC").fill("Toko Fotocopy");
    await page.getByLabel("No. Bukti / Referensi").fill(bukti);
    // PNG 1x1 yang sah, supaya cabang "tampilkan sebagai gambar" teruji.
    await page.getByTestId("form-lampiran").setInputFiles({
      name: "kuitansi.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await page.getByRole("button", { name: /Simpan Pengeluaran/ }).click();
    await expect(page.getByText(/berhasil disimpan/)).toBeVisible({ timeout: 15_000 });

    const terakhir = await apiCall<{ data: Array<{ id: number }> }>(
      token,
      "/api/pembayaran?per_page=1",
    );
    pengeluaranId = terakhir.body.data[0].id;

    // Tombol Detail ada di barisnya.
    const tombol = page.getByTestId(`detail-pengeluaran-${pengeluaranId}`);
    await expect(tombol).toBeVisible({ timeout: 10_000 });
    await tombol.click();

    const modal = page.getByTestId("detail-pengeluaran");
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Seluruh isian form tampil, bukan sebagian.
    for (const label of [
      "Yayasan",
      "Vihara",
      "Tanggal",
      "Jumlah",
      "Kategori Biaya",
      "Nama Pengeluaran",
      "Metode Pembayaran",
      "Transfer dari Rekening",
      "Dibayarkan kepada / PIC",
      "No. Bukti / Referensi",
      "Disetujui oleh",
    ]) {
      await expect(modal.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(modal).toContainText("Toko Fotocopy");
    await expect(modal).toContainText(bukti);

    // Lampiran gambar benar-benar termuat, bukan ikon rusak.
    const gambar = modal.getByTestId("lampiran-gambar");
    await expect(gambar).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => gambar.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  });

  test("FV-15: pengeluaran tanpa lampiran berkata 'Tidak ada lampiran', bukan error", async ({
    page,
  }) => {
    const tanpa = await apiCall<Dibuat>(token, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: new Date().toLocaleDateString("en-CA"),
        method: "transfer",
        category: "biaya_operasional",
        name: "Biaya ATK",
        amount: 17000,
        vihara_id: viharaVvg,
        bank_account_id: rekening,
      }),
    });
    await apiCall(token, `/api/pembayaran/${tanpa.body.id}/post`, { method: "POST" });

    await login(page, "admin");
    await page.goto("/pembayaran");
    await page.getByTestId(`detail-pengeluaran-${tanpa.body.id}`).click();

    const modal = page.getByTestId("detail-pengeluaran");
    await expect(modal.getByTestId("tanpa-lampiran")).toHaveText("Tidak ada lampiran");
  });

  test("FV-17 & FV-19: tanggal terbaca dan tombol Detail layak klik", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/jurnal");

    const baris = page.locator("tbody tr").first();
    await expect(baris).toBeVisible({ timeout: 10_000 });

    // Tidak ada lagi stempel waktu mentah di mana pun di halaman.
    await expect(page.locator("body")).not.toContainText(/\d{4}-\d{2}-\d{2}T\d{2}:/);
    // Dan formatnya DD/MM/YYYY.
    await expect(baris.locator("td").first()).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);

    const detail = page.locator('[data-testid^="detail-je-"]').first();
    await expect(detail).toHaveText("Detail");
    const kotak = await detail.boundingBox();
    expect(kotak!.height, "tinggi area klik minimal 32px").toBeGreaterThanOrEqual(32);
  });

  test("FV-18: jurnal menyebut sumber, vihara, dan membuka transaksinya", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/jurnal");

    const kolom = await page.locator("thead th").allTextContents();
    expect(kolom.map((t) => t.trim())).toContain("Vihara");

    // Baris jurnal dari pengeluaran tadi menyebut jenis, kode, dan nama
    // pengeluarannya — bukan cuma nama kategori yang sama untuk semuanya.
    const baris = page.locator("tbody tr").filter({ hasText: bukti }).first();
    await expect(baris).toBeVisible({ timeout: 10_000 });
    await expect(baris).toContainText("Pengeluaran");
    await expect(baris).toContainText("Biaya ATK");
    await expect(baris).toContainText("Toko Fotocopy");
    await expect(baris).toContainText("Vipassan");

    // Dan dari situ transaksi sumbernya bisa dibuka.
    await baris.locator('[data-testid^="sumber-je-"]').click();
    const modal = page.getByTestId("detail-pengeluaran");
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal).toContainText(bukti);
  });
});
