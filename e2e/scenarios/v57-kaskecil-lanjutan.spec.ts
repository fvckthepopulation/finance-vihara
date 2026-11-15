/**
 * v57 — Kas Kecil lanjutan dan dua perbaikan form/laporan:
 *   FV-81 draft kas kecil bisa diubah, dihapus, dan diposting (juga dari Persetujuan)
 *   FV-82 Kategori Biaya & Nama Pengeluaran kas kecil dari master
 *   FV-83 Lampiran Bukti, FV-84 tombol Detail, FV-85 Catatan
 *   FV-86 filter tanggal dari-sampai + total periode di riwayat
 *   FV-87 deskripsi jurnal kas kecil menyebut keperluannya
 *   FV-79 Nama Penerimaan wajib di form
 *   FV-80 Laporan Penerimaan Dana punya filter Yayasan & Vihara sendiri
 */
import { test, expect, Page } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

test.describe.configure({ mode: "serial" });

const HARI_INI = () => new Date().toLocaleDateString("en-CA");
const PNG = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F8FFFF3F0005FE02FEA7D605C90000000049454E44AE426082",
  "hex",
);

async function bukaKasKecil(page: Page, viharaVvg: number) {
  await page.goto("/petty-cash");
  await page.getByTestId("form-vihara").selectOption(String(viharaVvg));
  await expect(page.getByText("Riwayat Mutasi Kas Kecil")).toBeVisible({ timeout: 15_000 });
}

test.describe("v57 kas kecil lanjutan", () => {
  let admin = "";
  let viharaVvg = 0;
  const catatan = uniq("v57-draft");

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
  });

  test("FV-82/83/85: Admin Vihara mencatat penggunaan dengan nama master, lampiran, catatan → draft", async ({ page }) => {
    await login(page, "adminVihara");
    await bukaKasKecil(page, viharaVvg);

    const form = page.getByTestId("form-penggunaan");
    await selectByLabelRegex(form.getByLabel("PIC Kas Kecil"), /Lili/);
    // Nama Pengeluaran baru terbuka setelah kategori dipilih, dan isinya dari master.
    await expect(form.getByTestId("kaskecil-nama")).toBeDisabled();
    await form.getByTestId("kaskecil-kategori").selectOption("biaya_bhikkhu");
    await expect(form.getByTestId("kaskecil-nama").locator("option", { hasText: "Biaya Makan Bhikkhu" })).toBeAttached({
      timeout: 10_000,
    });
    await expect(form.getByTestId("kaskecil-nama").locator("option", { hasText: "Biaya ATK" })).toHaveCount(0);
    await form.getByTestId("kaskecil-nama").selectOption("Biaya Makan Bhikkhu");
    await form.getByLabel("Jumlah (Rp)").fill("41000");
    await form.getByLabel("No. Bukti / Kuitansi").fill("BKK-V57");
    await form.getByTestId("penggunaan-catatan").fill(catatan);
    await form.getByTestId("penggunaan-lampiran").setInputFiles({ name: "nota.png", mimeType: "image/png", buffer: PNG });
    await form.getByRole("button", { name: "Catat Penggunaan" }).click();
    await expect(page.getByText("menunggu persetujuan").first()).toBeVisible({ timeout: 10_000 });

    const baris = page.locator("tbody tr", { hasText: "Biaya Makan Bhikkhu" }).filter({ hasText: "Draft" }).first();
    await expect(baris).toBeVisible({ timeout: 10_000 });
    // Admin Vihara: Ubah & Hapus ada, Posting tidak (FV-81).
    await expect(baris.getByRole("button", { name: "Ubah" })).toBeVisible();
    await expect(baris.getByRole("button", { name: "Hapus" })).toBeVisible();
    await expect(baris.getByRole("button", { name: "Posting" })).toHaveCount(0);
  });

  test("FV-81/84: Admin Vihara mengubah draft lewat Ubah, Detail menampilkan isi lengkap", async ({ page }) => {
    await login(page, "adminVihara");
    await bukaKasKecil(page, viharaVvg);
    await page.getByTestId("cari-kaskecil").fill(catatan);
    const baris = page.locator("tbody tr").filter({ hasText: "Draft" }).first();
    await expect(baris).toBeVisible({ timeout: 10_000 });

    await baris.getByRole("button", { name: "Ubah" }).click();
    const modal = page.getByTestId("ubah-kaskecil");
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId("kaskecil-nama")).toHaveValue("Biaya Makan Bhikkhu");
    await modal.getByLabel("Jumlah (Rp)").fill("43000");
    await modal.getByRole("button", { name: "Simpan Perubahan" }).click();
    await expect(page.getByText("Draft kas kecil diperbarui")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("tbody tr").filter({ hasText: "43.000" }).first()).toBeVisible({ timeout: 10_000 });

    await page.locator("tbody tr").filter({ hasText: "43.000" }).first().getByRole("button", { name: "Detail" }).click();
    const detail = page.getByTestId("detail-kaskecil");
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId("detail-kk-Nama Pengeluaran")).toHaveText("Biaya Makan Bhikkhu");
    await expect(detail.getByTestId("detail-kk-Catatan")).toHaveText(catatan);
    await expect(detail.getByTestId("detail-kk-Akun beban")).toContainText("5100");
    await expect(detail.getByTestId("kk-lampiran-gambar")).toBeVisible({ timeout: 10_000 });
    await expect(detail.getByText("Admin Vihara VVG").first()).toBeVisible();
    await expect(detail.getByTestId("detail-kaskecil-posting")).toHaveCount(0);
  });

  test("FV-81: draft kas kecil muncul di Persetujuan dan bisa disetujui approver", async ({ page }) => {
    await login(page, "approver");
    await page.goto("/persetujuan");
    const antrean = page.getByTestId("antrean-kaskecil");
    await expect(antrean).toBeVisible({ timeout: 15_000 });
    const baris = antrean.locator("tbody tr", { hasText: "Biaya Makan Bhikkhu" }).filter({ hasText: "43.000" }).first();
    await expect(baris).toBeVisible({ timeout: 10_000 });
    await baris.getByRole("button", { name: "Setujui" }).click();
    await expect(page.getByText(/disetujui dan diposting/)).toBeVisible({ timeout: 10_000 });
    await expect(baris).toHaveCount(0, { timeout: 10_000 });
  });

  test("FV-87: deskripsi jurnal menyebut keperluan, PIC, kategori, no. bukti", async () => {
    const cari = await apiCall<{ data: Array<{ id: number; reference: string | null; journal_entry_id: number | null; status: string }> }>(
      admin,
      `/api/petty-cash?vihara_id=${viharaVvg}&q=${encodeURIComponent(catatan)}`,
    );
    const m = cari.body.data[0];
    expect(m.status).toBe("posted");
    const je = await apiCall<{ description: string }>(admin, `/api/journal-entries/${m.journal_entry_id}`);
    expect(je.body.description).toContain("Biaya Makan Bhikkhu");
    expect(je.body.description).toContain("Pemakaian Kas Kecil");
    expect(je.body.description).toContain("Lili");
    expect(je.body.description).toContain("No. Bukti BKK-V57");
    expect(je.body.description, "catatan tidak menimpa deskripsi jurnal (FV-51)").not.toContain(catatan);
  });

  test("FV-86: filter tanggal dari-sampai + total periode", async ({ page }) => {
    await login(page, "admin");
    await bukaKasKecil(page, viharaVvg);
    const hari = HARI_INI();
    await page.getByTestId("kaskecil-dari").fill(hari);
    await page.getByTestId("kaskecil-sampai").fill(hari);
    await expect
      .poll(async () => {
        const tgl = await page.locator("tbody tr td:first-child").allInnerTexts();
        return tgl.length > 0 && tgl.every((t) => t === new Date(hari).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }));
      }, { timeout: 15_000 })
      .toBe(true);
    await expect(page.getByTestId("kaskecil-total")).toContainText("periode ini");

    // Total di layar = total API untuk filter yang sama.
    const api = await apiCall<{ totals: { masuk: string; keluar: string } }>(
      admin,
      `/api/petty-cash?vihara_id=${viharaVvg}&from=${hari}&to=${hari}`,
    );
    const rp = (n: string) => "Rp " + Math.round(Number(n)).toLocaleString("id-ID");
    await expect(page.getByTestId("kaskecil-total-masuk")).toHaveText(rp(api.body.totals.masuk));
    await expect(page.getByTestId("kaskecil-total-keluar")).toHaveText(rp(api.body.totals.keluar));

    // Rentang terbalik → pesan, tidak memuat daftar.
    await page.getByTestId("kaskecil-dari").fill("2026-12-31");
    await page.getByTestId("kaskecil-sampai").fill("2026-01-01");
    await expect(page.getByTestId("kaskecil-rentang-salah")).toBeVisible();
  });

  test("FV-81: Hapus draft dari riwayat", async ({ page }) => {
    // Draft baru lewat API, lalu dihapus dari layar.
    const nama = (
      await apiCall<{ data: Array<{ name: string }> }>(
        admin,
        `/api/masters/transaction-names?type=pengeluaran&category=biaya_operasional&vihara_id=${viharaVvg}`,
      )
    ).body.data[0].name;
    const pics = (await apiCall<{ data: Array<{ id: number; name: string }> }>(admin, `/api/masters/petty-cash-pics?vihara_id=${viharaVvg}`)).body.data;
    const tanda = uniq("v57-hapus");
    const dibuat = await apiCall<{ id: number }>(admin, "/api/petty-cash", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(), pic_id: pics[0].id, subtype: "usage", amount: 7000, vihara_id: viharaVvg,
        category: "biaya_operasional", name: nama, notes: tanda,
      }),
    });
    expect(dibuat.status).toBe(201);

    await login(page, "admin");
    await bukaKasKecil(page, viharaVvg);
    await page.getByTestId("cari-kaskecil").fill(tanda);
    await page.getByTestId(`hapus-kaskecil-${dibuat.body.id}`).click();
    await page.getByTestId("dialog-konfirmasi").click();
    await expect(page.getByText(`Draft kas kecil #${dibuat.body.id} dihapus`)).toBeVisible({ timeout: 10_000 });
    expect((await apiCall(admin, `/api/petty-cash/${dibuat.body.id}`)).status).toBe(404);
  });
});

test.describe("v57 FV-79 & FV-80", () => {
  test("FV-79: Input Penerimaan tanpa Nama Penerimaan ditolak di form", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/penerimaan");
    const viharaVvg = (await viharaIdsByCode()).VVG;
    await selectByLabelRegex(page.getByTestId("form-yayasan"), /YDI|Dhammavihara/);
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));
    await page.getByTestId("form-kategori").selectOption({ index: 1 });
    await page.getByLabel("Jumlah (Rp) *").fill("10000");
    // Nama Penerimaan sengaja dibiarkan kosong, lalu langsung diajukan.
    await page.getByTestId("tombol-ajukan").click();
    await expect(page.getByText("Nama Penerimaan wajib dipilih.")).toBeVisible({ timeout: 10_000 });
  });

  test("FV-80: Laporan Penerimaan Dana punya filter Yayasan & Vihara sendiri", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/cetak");
    const yys = page.getByTestId("cetak-yayasan");
    const vih = page.getByTestId("cetak-vihara");
    await expect(yys).toBeVisible({ timeout: 15_000 });
    await expect(yys.locator("option", { hasText: "Semua yayasan" })).toBeAttached();
    // Tunggu daftar yayasan termuat, baru periksa kuncinya. Bila jangkauan
    // akun hanya satu yayasan, pilihannya sudah terisi & terkunci.
    await expect(yys.locator("option", { hasText: "YDI" })).toBeAttached({ timeout: 15_000 });
    if (await yys.isEnabled()) await selectByLabelRegex(yys, /YDI/);
    await expect(yys).toHaveValue(/\d+/);
    // Vihara hanya milik YDI.
    const opsi = await vih.locator("option").allInnerTexts();
    expect(opsi[0]).toBe("Semua vihara");
    expect(opsi.some((t) => /Vipassan/.test(t))).toBe(true);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByText(/LAPORAN KEUANGAN YAYASAN/i).first()).toBeVisible({ timeout: 20_000 });

    await selectByLabelRegex(vih, /Vipassan/);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByText(/LAPORAN KEUANGAN VIH/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("FV-80: Admin Vihara — filter yayasan & vihara terkunci ke miliknya", async ({ page }) => {
    await login(page, "adminVihara");
    await page.goto("/cetak");
    await expect(page.getByTestId("cetak-yayasan")).toBeDisabled({ timeout: 15_000 });
    await expect(page.getByTestId("cetak-vihara")).toBeDisabled();
    await expect(page.getByTestId("cetak-vihara")).not.toHaveValue("");
  });
});
