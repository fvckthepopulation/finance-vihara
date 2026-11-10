/**
 * v11 — Input Pengeluaran.
 * Yang diuji: cascade kategori biaya → nama pengeluaran, kewajiban memilih
 * rekening sumber, submit pengeluaran via Transfer Bank (rekening BCA) →
 * toast sukses + baris di "Pengeluaran Hari Ini" dengan tag Debet Dana
 * "Dana Operasional".
 *
 * Sejak vihara transaksi pindah dari header ke form, setiap tes di sini
 * memilih vihara DI FORM. Header tetap dipilih karena yang menyaring tabel
 * "Pengeluaran Hari Ini" masih header.
 */
import { test, expect } from "@playwright/test";
import { API_BASE, apiCall, apiToken, login, pickViharaVVG, viharaIdsByCode } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

test.describe("v11 pengeluaran", () => {
  let viharaVvg = 0;

  test.beforeAll(async () => {
    await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
  });

  test("cascade kategori biaya → nama pengeluaran", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/pembayaran");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    const nama = page.getByLabel("Nama Pengeluaran *");
    await expect(nama).toBeDisabled();
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await expect(nama).toBeEnabled();
    await nama.locator("option", { hasText: "Biaya ATK" }).first().waitFor({ state: "attached" });
  });

  test("submit pengeluaran → toast + baris Hari Ini dengan tag dana", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/pembayaran");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    const bukti = uniq("E2E-PAY");
    await page.getByLabel("Jumlah (Rp) *").fill("45000");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await selectByLabelRegex(page.getByLabel("Nama Pengeluaran *"), /Biaya ATK/);
    await selectByLabelRegex(page.getByLabel("Transfer dari Rekening"), /BCA/);
    await page.getByLabel("No. Bukti / Referensi").fill(bukti);
    await page.getByRole("button", { name: "Simpan Pengeluaran" }).click();

    await expect(page.getByText("Pengeluaran berhasil disimpan")).toBeVisible({ timeout: 10_000 });

    const row = page
      .locator("tr", { hasText: "Biaya ATK" })
      .filter({ hasText: "45.000" })
      .filter({ hasText: "Dana Operasional" });
    await expect(row.first()).toBeVisible({ timeout: 10_000 });
  });

  test("rekening sumber wajib: simpan tertahan sampai dipilih", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/pembayaran");

    const rekening = page.getByTestId("form-rekening");

    // Sebelum vihara dipilih, rekening belum bisa diisi — daftarnya memang
    // milik vihara.
    await expect(rekening).toBeDisabled({ timeout: 10_000 });
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));
    await expect(rekening).toBeEnabled();

    // Label bertanda wajib, sejajar field wajib lainnya.
    const label = await rekening.evaluate(
      (el) => el.closest("label")?.querySelector("span")?.textContent ?? "",
    );
    expect(label).toContain("*");
    await expect(rekening).toHaveJSProperty("required", true);

    // Isi semua KECUALI rekening → simpan tetap tertahan.
    await page.getByLabel("Jumlah (Rp) *").fill("45000");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await selectByLabelRegex(page.getByLabel("Nama Pengeluaran *"), /Biaya ATK/);
    await expect(rekening).toHaveValue("");
    await expect(page.getByRole("button", { name: "Simpan Pengeluaran" })).toBeDisabled();
    await expect(page.getByText("Pilih rekening sumber dulu")).toBeVisible();

    // Begitu rekening dipilih, penahannya lepas.
    await selectByLabelRegex(rekening, /BCA/);
    await expect(page.getByRole("button", { name: "Simpan Pengeluaran" })).toBeEnabled();
  });

  test("API menolak pengeluaran transfer tanpa rekening, dengan pesan terbaca", async () => {
    const token = await apiToken("admin");
    const res = await fetch(`${API_BASE}/api/pembayaran`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: new Date().toLocaleDateString("en-CA"),
        method: "transfer",
        category: "biaya_operasional",
        name: "Biaya ATK",
        amount: 45000,
        vihara_id: viharaVvg,
      }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { message: string };
    // Bukan kunci mentah `validation.required`, dan menyebut field yang
    // benar-benar ada di form.
    expect(body.message).toContain("Transfer dari Rekening");
  });

  test("tabel Hari Ini memuat kolom Vihara dan Rekening pada posisinya", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/pembayaran");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    // Simpan satu baris supaya ada isi yang bisa diperiksa.
    const bukti = uniq("E2E-KOLOM");
    await page.getByLabel("Jumlah (Rp) *").fill("77000");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await selectByLabelRegex(page.getByLabel("Nama Pengeluaran *"), /Biaya ATK/);
    await selectByLabelRegex(page.getByTestId("form-rekening"), /BCA/);
    await page.getByLabel("No. Bukti / Referensi").fill(bukti);
    await page.getByRole("button", { name: "Simpan Pengeluaran" }).click();
    await expect(page.getByText("Pengeluaran berhasil disimpan")).toBeVisible({ timeout: 10_000 });

    // Urutan kolom persis seperti yang diminta: Vihara di antara Tanggal dan
    // Nama Pengeluaran, Rekening di antara Debet Dana dan Jumlah.
    const kolom = await page
      .locator("table")
      .last()
      .locator("thead th")
      .allTextContents();
    expect(kolom.map((t) => t.trim())).toEqual([
      "Tanggal",
      "Vihara",
      "Nama Pengeluaran",
      "Kategori Biaya",
      "Debet Dana",
      "Rekening",
      "Jumlah",
    ]);

    // Dan isinya benar-benar terisi, bukan kolom kosong.
    const baris = page.locator("tbody tr").filter({ hasText: "77.000" }).first();
    await expect(baris).toBeVisible({ timeout: 10_000 });
    await expect(baris.locator("td").nth(1)).toContainText("Vipassan");
    await expect(baris.locator("td").nth(5)).toContainText("BCA");
  });

  test("dropdown Nama Pengeluaran: urut tanpa bedakan besar-kecil, tanpa singkatan", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/pembayaran");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    const nama = page.getByLabel("Nama Pengeluaran *");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await expect.poll(async () => (await nama.locator("option").count()) > 1).toBe(true);

    const items = (await nama.locator("option").allTextContents())
      .map((t) => t.trim())
      .filter((t) => !t.startsWith("—"));

    // Urut alfabetis TANPA membedakan huruf besar-kecil. Contoh dari laporan:
    // "Biaya Admin Bank" harus mendahului "Biaya ATK" — pada urutan yang
    // membedakan besar-kecil, justru sebaliknya.
    const urutTanpaBesarKecil = [...items].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
    expect(items).toEqual(urutTanpaBesarKecil);
    expect(items.indexOf("Biaya Admin Bank")).toBeLessThan(items.indexOf("Biaya ATK"));

    // Tidak ada lagi singkatan berhuruf kecil.
    expect(items.filter((t) => /\b(adm|kep)\b/i.test(t))).toEqual([]);

    // Setiap kata diawali huruf kapital (angka dibiarkan, mis. "Biaya 17an";
    // akronim seperti ATK / PPh / SMB tetap apa adanya).
    const melanggar = items.filter((t) =>
      t.split(/\s+/).some((kata) => /^[a-z]/.test(kata)),
    );
    expect(melanggar).toEqual([]);
  });

  test("nama khusus satu vihara tidak muncul di vihara lain", async ({ page }) => {
    const KHUSUS_VVG = "Biaya Keperluan SMB VVG";

    // Bendahara VVG: item miliknya ada.
    await login(page, "bendahara");
    await page.goto("/pembayaran");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    const namaVvg = page.getByLabel("Nama Pengeluaran *");
    await expect
      .poll(async () => (await namaVvg.locator("option").allTextContents()).join("|"))
      .toContain(KHUSUS_VVG);

    // Bendahara VBM: item itu TIDAK ada, tapi item umum tetap ada.
    await login(page, "bendaharaVbm");
    await page.goto("/pembayaran");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    const namaVbm = page.getByLabel("Nama Pengeluaran *");
    await expect
      .poll(async () => (await namaVbm.locator("option").allTextContents()).join("|"))
      .toContain("Biaya ATK");
    const daftarVbm = await namaVbm.locator("option").allTextContents();
    expect(daftarVbm.join("|")).not.toContain(KHUSUS_VVG);
  });

  test("API menolak nama milik vihara lain, bukan sekadar menyembunyikannya", async () => {
    const KHUSUS_VVG = "Biaya Keperluan SMB VVG";
    const token = await apiToken("bendaharaVbm");

    // Rekening milik VBM sendiri, supaya yang diuji benar-benar namanya.
    const rekening = await apiCall<{ data?: Array<{ id: number }> } | Array<{ id: number }>>(
      token,
      "/api/masters/vihara-bank-accounts",
    );
    const daftar = Array.isArray(rekening.body) ? rekening.body : (rekening.body.data ?? []);
    expect(daftar.length).toBeGreaterThan(0);

    const res = await apiCall<{ message: string }>(token, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: new Date().toLocaleDateString("en-CA"),
        method: "transfer",
        category: "biaya_operasional",
        name: KHUSUS_VVG,
        amount: 5000,
        bank_account_id: daftar[0].id,
      }),
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain("tidak berlaku untuk vihara ini");
  });

  test("lampiran bukti: terunggah bersama transaksi dan bisa dibuka dari Semua Transaksi", async ({
    page,
  }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/pembayaran");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    // Field ada tepat di bawah No. Bukti / Referensi.
    const lampiran = page.getByTestId("form-lampiran");
    await expect(lampiran).toBeVisible();
    const posisi = await page.evaluate(() => {
      const teks = [...document.querySelectorAll("label")].map(
        (l) => l.querySelector("span")?.textContent ?? "",
      );
      return {
        bukti: teks.indexOf("No. Bukti / Referensi"),
        lampiran: teks.indexOf("Lampiran Bukti"),
      };
    });
    expect(posisi.lampiran).toBe(posisi.bukti + 1);

    const bukti = uniq("E2E-LAMP");
    await page.getByLabel("Jumlah (Rp) *").fill("99000");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await selectByLabelRegex(page.getByLabel("Nama Pengeluaran *"), /Biaya ATK/);
    await selectByLabelRegex(page.getByTestId("form-rekening"), /BCA/);
    await page.getByLabel("No. Bukti / Referensi").fill(bukti);
    await lampiran.setInputFiles({
      name: "kuitansi-uji.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"),
    });

    await page.getByRole("button", { name: "Simpan Pengeluaran" }).click();
    await expect(page.getByText("berhasil disimpan beserta lampirannya")).toBeVisible({
      timeout: 15_000,
    });

    // Baris itu bisa dibuka buktinya dari Semua Transaksi.
    await page.goto("/riwayat");
    const baris = page.locator("tbody tr").filter({ hasText: "99.000" }).first();
    await expect(baris).toBeVisible({ timeout: 10_000 });
    const tombol = baris.locator('[data-testid^="bukti-"]');
    await expect(tombol).toBeVisible();

    // Dan berkasnya benar-benar terambil — bukan tombol kosong.
    const id = (await tombol.getAttribute("data-testid"))!.split("-").pop();
    const token = await apiToken("admin");
    const unduh = await fetch(`${API_BASE}/api/pembayaran/${id}/attachment`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(unduh.status).toBe(200);
    expect(unduh.headers.get("content-type")).toContain("pdf");
    expect((await unduh.arrayBuffer()).byteLength).toBeGreaterThan(0);

    // Lampiran ikut hirarki: vihara lain tidak boleh mengunduhnya.
    const tokenVbm = await apiToken("bendaharaVbm");
    const dicuri = await fetch(`${API_BASE}/api/pembayaran/${id}/attachment`, {
      headers: { Authorization: `Bearer ${tokenVbm}`, Accept: "application/json" },
    });
    expect(dicuri.status).toBe(403);
  });
});
