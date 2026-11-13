/**
 * v45 — Master Rekening (FV-30).
 *
 * Rekening vihara sudah tersimpan beserta akun COA-nya, tapi satu-satunya
 * cara mengelolanya adalah panel kecil di dalam baris Admin → Vihara: tidak
 * ada daftar lintas vihara, tidak ada pencarian, tidak ada jenis Bank vs Kas
 * Tunai, dan tidak ada penjagaan nomor rekening kembar.
 *
 * Catatan soal "rekening mengikuti Metode Pembayaran": layar Input
 * Pengeluaran memang hanya punya satu metode (Transfer Bank) karena
 * pengeluaran tunai lewat Kas Kecil. Jadi aturannya diuji sebagai: rekening
 * jenis Kas Tunai TIDAK boleh muncul di "Transfer dari Rekening".
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { uniq } from "../fixtures/uniq";

type Rekening = { id: number };

test.describe.configure({ mode: "serial" });

test.describe("v45 master rekening", () => {
  let token = "";
  let viharaVvg = 0;
  const dibersihkan: number[] = [];

  test.beforeAll(async () => {
    token = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
  });

  test.afterAll(async () => {
    for (const id of dibersihkan) {
      await apiCall(token, `/api/vihara-bank-accounts/${id}`, { method: "DELETE" });
    }
  });

  test("FV-30: daftar lintas vihara dengan pencarian & pagination", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/rekening");

    const kolom = (await page.locator("thead th").allTextContents()).map((t) => t.trim());
    expect(kolom).toEqual([
      "Vihara",
      "Jenis",
      "Nama Bank / Kas",
      "No. Rekening",
      "Atas Nama",
      "Akun COA",
      "Status",
      "Aksi",
    ]);

    await expect(page.getByTestId("pagination-info")).toHaveText(/^Menampilkan 1–\d+ dari \d+ data$/, {
      timeout: 15_000,
    });

    // Pencarian di server, tidak membedakan huruf besar/kecil.
    await page.getByTestId("cari-rekening").fill("mandiri");
    await expect(page.getByTestId("pagination-info")).toHaveText(/dari 1 data$/, {
      timeout: 15_000,
    });
    await page.getByTestId("cari-rekening").fill("zzz-tidak-ada");
    await expect(page.getByText("Data tidak ditemukan")).toBeVisible({ timeout: 15_000 });
  });

  test("FV-30: tambah rekening bank lewat form, lengkap dengan akun COA", async ({ page }) => {
    const nomor = uniq("77-88").replace(/[^\d-]/g, "") || "77-88-99";
    await login(page, "admin");
    await page.goto("/admin/rekening");
    await page.getByTestId("tambah-rekening").click();

    await page.getByTestId("rekening-vihara").selectOption(String(viharaVvg));
    await page.getByTestId("rekening-jenis").selectOption("bank");
    await page.getByTestId("rekening-nama-bank").fill("Bank Uji E2E");
    await page.getByTestId("rekening-nomor").fill(nomor);
    await page.getByTestId("rekening-atas-nama").fill("Vihara Uji");
    await page.getByTestId("rekening-coa").selectOption("1130");
    await page.getByTestId("simpan-rekening").click();

    await expect(page.getByText("Rekening ditambahkan")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("cari-rekening").fill("Bank Uji E2E");
    await expect(page.locator("tbody")).toContainText(nomor, { timeout: 15_000 });
    await expect(page.locator("tbody")).toContainText("Bank Donasi");

    const daftar = await apiCall<{ data: Array<{ id: number; bank_name: string }> }>(
      token,
      `/api/master-rekening?q=${encodeURIComponent("Bank Uji E2E")}`,
    );
    const dibuat = daftar.body.data.find((b) => b.bank_name === "Bank Uji E2E");
    expect(dibuat).toBeTruthy();
    dibersihkan.push(dibuat!.id);
  });

  test("FV-30: nomor rekening kembar ditolak dengan pesannya", async () => {
    const nomor = uniq("90").replace(/[^\d]/g, "");
    const pertama = await apiCall<Rekening>(token, `/api/viharas/${viharaVvg}/bank-accounts`, {
      method: "POST",
      body: JSON.stringify({
        bank_name: "Bank Kembar E2E",
        account_number: nomor,
        account_name: "Uji",
        coa_account_code: "1130",
      }),
    });
    expect(pertama.status).toBe(201);
    dibersihkan.push(pertama.body.id);

    const kedua = await apiCall<{ message: string }>(
      token,
      `/api/viharas/${viharaVvg}/bank-accounts`,
      {
        method: "POST",
        body: JSON.stringify({
          bank_name: "Bank Kembar E2E",
          account_number: nomor,
          account_name: "Uji lagi",
          coa_account_code: "1130",
        }),
      },
    );
    expect(kedua.status).toBe(422);
    expect(kedua.body.message).toContain("Nomor rekening sudah terdaftar");
  });

  test("FV-30: kas tunai tanpa nomor rekening, dan tidak muncul di Input Pengeluaran", async ({
    page,
  }) => {
    const nama = uniq("Kas Tunai E2E");
    const kas = await apiCall<Rekening>(token, `/api/viharas/${viharaVvg}/bank-accounts`, {
      method: "POST",
      body: JSON.stringify({
        type: "cash",
        bank_name: nama,
        account_name: "Vihara",
        coa_account_code: "1110",
      }),
    });
    expect(kas.status, "kas tunai tidak butuh nomor rekening").toBe(201);
    dibersihkan.push(kas.body.id);

    // Lookup tanpa saringan memuatnya; dengan type=bank tidak.
    const semua = await apiCall<{ data: Array<{ id: number }> }>(
      token,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}`,
    );
    expect(semua.body.data.some((b) => b.id === kas.body.id)).toBe(true);
    const hanyaBank = await apiCall<{ data: Array<{ id: number }> }>(
      token,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}&type=bank`,
    );
    expect(hanyaBank.body.data.some((b) => b.id === kas.body.id)).toBe(false);

    // Dan di layar Input Pengeluaran pilihannya memang tidak ada.
    await login(page, "admin");
    await page.goto("/pembayaran");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));
    const pilihan = page.getByTestId("form-rekening").locator("option");
    await expect(pilihan.first()).toBeAttached({ timeout: 15_000 });
    const teks = await pilihan.allTextContents();
    expect(teks.join("|")).not.toContain(nama);
  });

  test("FV-30: rekening terpakai tidak bisa dihapus, hanya dinonaktifkan", async ({ page }) => {
    // Rekening BCA VVG dipakai banyak transaksi contoh.
    const daftar = await apiCall<{ data: Array<{ id: number; in_use: boolean; label: string }> }>(
      token,
      `/api/master-rekening?vihara_id=${viharaVvg}&q=BCA`,
    );
    const terpakai = daftar.body.data.find((b) => b.in_use);
    expect(terpakai, "harus ada rekening yang sudah dipakai transaksi").toBeTruthy();

    // API menolak hapus, dengan jalan keluarnya disebut.
    const hapus = await apiCall<{ message: string }>(
      token,
      `/api/vihara-bank-accounts/${terpakai!.id}`,
      { method: "DELETE" },
    );
    expect(hapus.status).toBe(422);
    expect(hapus.body.message).toMatch(/Nonaktifkan/i);

    // Dan tombol Hapus-nya memang tidak dirender.
    await login(page, "admin");
    await page.goto("/admin/rekening");
    await expect(page.getByTestId(`rekening-row-${terpakai!.id}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`hapus-rekening-${terpakai!.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`status-rekening-${terpakai!.id}`)).toBeVisible();
  });

  test("FV-30: daftar terbatas vihara dalam jangkauan user", async () => {
    const vbm = await apiToken("bendaharaVbm");
    const res = await apiCall<{ data: Array<{ vihara_name: string }> }>(vbm, "/api/master-rekening");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const b of res.body.data) {
      expect(b.vihara_name).toMatch(/Buddhametta/);
    }
  });

  test("FV-30: tanpa izin kelola, menambah rekening ditolak", async () => {
    const viewer = await apiToken("viewer");
    const res = await apiCall(viewer, `/api/viharas/${viharaVvg}/bank-accounts`, {
      method: "POST",
      body: JSON.stringify({
        bank_name: "Bank Nekat",
        account_number: "000-000",
        account_name: "x",
        coa_account_code: "1130",
      }),
    });
    expect(res.status).toBe(403);
  });
});
