/**
 * v46 — Master Pengeluaran (FV-29).
 *
 * Kategori Biaya dan Nama Pengeluaran dulunya konstanta PHP dan satu tabel
 * lookup tanpa akun: admin tidak bisa menambah apa pun, dan akun debit jurnal
 * selalu satu akun untuk seluruh kategori. Sekarang keduanya master dua
 * tingkat, dan akun beban ditentukan per Nama Pengeluaran.
 *
 * Yang paling penting diuji: kode kategori lama tetap dipakai apa adanya,
 * sehingga transaksi yang sudah ada tidak terputus dari masternya.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

type Dibuat = { id: number };

test.describe.configure({ mode: "serial" });

test.describe("v46 master pengeluaran", () => {
  let token = "";
  let viharaVvg = 0;
  let rekening = 0;
  const kategoriUji = `uji_${Date.now().toString().slice(-6)}`;
  const namaUji = uniq("Biaya Uji");
  let namaUjiId = 0;
  let kategoriUjiId = 0;
  const pembayaranDibuat: number[] = [];

  test.beforeAll(async () => {
    token = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
    const rek = await apiCall<{ data: Array<{ id: number }> }>(
      token,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}&type=bank`,
    );
    rekening = rek.body.data[0].id;
  });

  test.afterAll(async () => {
    for (const id of pembayaranDibuat) {
      await apiCall(token, `/api/pembayaran/${id}`, { method: "DELETE" });
    }
    if (namaUjiId) {
      await apiCall(token, `/api/master-pengeluaran/nama/${namaUjiId}`, { method: "DELETE" });
    }
    if (kategoriUjiId) {
      await apiCall(token, `/api/master-pengeluaran/kategori/${kategoriUjiId}`, {
        method: "DELETE",
      });
    }
  });

  test("FV-29: kategori lama pindah ke master dengan kode yang sama", async () => {
    const res = await apiCall<{ data: Array<{ code: string; default_debit_code: string }> }>(
      token,
      "/api/master-pengeluaran/kategori?per_page=100",
    );
    const kode = res.body.data.map((k) => k.code);
    // Kode inilah yang tersimpan di kolom pembayaran.category — kalau berubah,
    // transaksi lama kehilangan kategorinya.
    for (const lama of ["biaya_operasional", "biaya_bhikkhu", "komisi_platform"]) {
      expect(kode, `kategori lama ${lama} harus ada di master`).toContain(lama);
    }

    // Dan tiap Nama Pengeluaran lama sudah mewarisi akun kategorinya.
    const nama = await apiCall<{ data: Array<{ name: string; coa_account_code: string | null }> }>(
      token,
      "/api/master-pengeluaran/nama?category=biaya_operasional&per_page=100",
    );
    expect(nama.body.data.length).toBeGreaterThan(0);
    for (const n of nama.body.data) {
      expect(n.coa_account_code, `${n.name} harus punya akun`).toBeTruthy();
    }
  });

  test("FV-29: layar master dua tingkat, memilih kategori menyaring namanya", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/pengeluaran");

    await expect(page.getByTestId("cari-kategori")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("cari-nama")).toBeVisible();
    // Dua tabel, dua navigasi halaman (FV-26).
    await expect(page.getByTestId("pagination-info")).toHaveCount(2);

    await page.getByTestId("kategori-row-biaya_bhikkhu").click();
    await expect(page.getByText("Nama Pengeluaran — Biaya Bhikkhu / Sangha")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid^="nama-row-"]').first()).toBeVisible({
      timeout: 15_000,
    });
    // Baris LAMA tetap terpasang selagi permintaan tersaring berjalan, dan
    // satu kali baca bisa menangkap campurannya: locator-nya di-resolve
    // sebelum render baru, isinya dibaca sesudahnya. Jadi yang dipoll adalah
    // KESELURUHAN kolom — ada isinya, dan semuanya kategori yang dipilih.
    await expect
      .poll(
        async () => {
          const kolom = await page
            .locator('[data-testid^="nama-row-"] td:nth-child(2)')
            .allTextContents();
          return kolom.length > 0 && kolom.every((t) => t.includes("Bhikkhu"));
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // Pencarian kategori (FV-27).
    await page.getByTestId("cari-kategori").fill("zzz-tidak-ada");
    await expect(page.getByText("Data tidak ditemukan").first()).toBeVisible({ timeout: 15_000 });
  });

  test("FV-29: tambah kategori lalu nama di bawahnya, lewat layar master", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/pengeluaran");

    await page.getByTestId("tambah-kategori").click();
    await page.getByTestId("kategori-kode").fill(kategoriUji);
    await page.getByTestId("kategori-nama").fill("Kategori Uji E2E");
    await page.getByTestId("kategori-akun").selectOption("6300");
    await page.getByTestId("simpan-kategori").click();
    await expect(page.getByText("Kategori ditambahkan")).toBeVisible({ timeout: 15_000 });

    const kategori = await apiCall<{ data: Array<{ id: number; code: string }> }>(
      token,
      `/api/master-pengeluaran/kategori?q=${kategoriUji}`,
    );
    kategoriUjiId = kategori.body.data.find((k) => k.code === kategoriUji)!.id;

    await page.getByTestId("tambah-nama").click();
    await page.getByTestId("nama-kategori").selectOption(kategoriUji);
    await page.getByTestId("nama-nama").fill(namaUji);
    await page.getByTestId("nama-akun").selectOption("6200");
    await page.getByTestId("simpan-nama").click();
    await expect(page.getByText("Nama pengeluaran ditambahkan")).toBeVisible({ timeout: 15_000 });

    const nama = await apiCall<{ data: Array<{ id: number; name: string; coa_account_code: string }> }>(
      token,
      `/api/master-pengeluaran/nama?q=${encodeURIComponent(namaUji)}`,
    );
    const dibuat = nama.body.data.find((n) => n.name === namaUji);
    expect(dibuat).toBeTruthy();
    expect(dibuat!.coa_account_code).toBe("6200");
    namaUjiId = dibuat!.id;
  });

  test("FV-29: nama kembar dalam satu kategori ditolak dengan pesannya", async () => {
    const res = await apiCall<{ message: string }>(token, "/api/master-pengeluaran/nama", {
      method: "POST",
      body: JSON.stringify({
        category: kategoriUji,
        // Huruf besar/kecil tidak membedakan — "biaya uji" = "Biaya Uji".
        name: namaUji.toLowerCase(),
        coa_account_code: "6200",
      }),
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain("Nama pengeluaran sudah ada di kategori ini");
  });

  test("FV-29: akun debit jurnal mengikuti Nama Pengeluaran, bukan kategorinya", async () => {
    // Nama uji memakai 6200, sedangkan akun bawaan kategorinya 6300.
    const dibuat = await apiCall<Dibuat & { debit_account_code: string }>(token, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: new Date().toLocaleDateString("en-CA"),
        method: "transfer",
        category: kategoriUji,
        name: namaUji,
        amount: 23000,
        vihara_id: viharaVvg,
        bank_account_id: rekening,
      }),
    });
    expect(dibuat.status).toBe(201);
    pembayaranDibuat.push(dibuat.body.id);
    expect(dibuat.body.debit_account_code, "akun nama dipakai, bukan akun kategori").toBe("6200");

    // Nama lain di kategori lain tetap memakai akunnya sendiri.
    const atk = await apiCall<Dibuat & { debit_account_code: string }>(token, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: new Date().toLocaleDateString("en-CA"),
        method: "transfer",
        category: "biaya_operasional",
        name: "Biaya ATK",
        amount: 1000,
        vihara_id: viharaVvg,
        bank_account_id: rekening,
      }),
    });
    expect(atk.status).toBe(201);
    pembayaranDibuat.push(atk.body.id);
    expect(atk.body.debit_account_code).toBe("6100");
  });

  test("FV-29: kategori nonaktif hilang dari form, kategori aktif tetap ada", async ({ page }) => {
    await apiCall(token, `/api/master-pengeluaran/kategori/${kategoriUjiId}`, {
      method: "PATCH",
      body: JSON.stringify({ active: false, nonaktifkan_anak: true }),
    });

    const pilihan = await apiCall<Array<{ key: string }>>(token, "/api/pembayaran/categories");
    const kunci = pilihan.body.map((c) => c.key);
    expect(kunci).not.toContain(kategoriUji);
    expect(kunci).toContain("biaya_operasional");

    // Dan transaksi baru dengan kategori nonaktif ditolak.
    const ditolak = await apiCall(token, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: new Date().toLocaleDateString("en-CA"),
        method: "transfer",
        category: kategoriUji,
        amount: 1000,
        vihara_id: viharaVvg,
        bank_account_id: rekening,
      }),
    });
    expect(ditolak.status).toBe(422);

    // Di form, dropdown kategorinya pun tidak memuatnya.
    await login(page, "admin");
    await page.goto("/pembayaran");
    const opsi = await page.getByLabel("Kategori Biaya *").locator("option").allTextContents();
    expect(opsi.join("|")).not.toContain("Kategori Uji E2E");

    await apiCall(token, `/api/master-pengeluaran/kategori/${kategoriUjiId}`, {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    await apiCall(token, `/api/master-pengeluaran/nama/${namaUjiId}`, {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
  });

  test("FV-29: kategori tidak bisa dinonaktifkan selama masih punya nama aktif", async () => {
    const res = await apiCall<{ message: string; jumlah_nama_aktif: number }>(
      token,
      `/api/master-pengeluaran/kategori/${kategoriUjiId}`,
      { method: "PATCH", body: JSON.stringify({ active: false }) },
    );
    expect(res.status).toBe(422);
    expect(res.body.jumlah_nama_aktif).toBeGreaterThan(0);
    expect(res.body.message).toMatch(/nonaktifkan_anak/);
  });

  test("FV-29: yang sudah dipakai transaksi hanya bisa dinonaktifkan", async ({ page }) => {
    // Nama uji sudah dipakai satu pembayaran di tes sebelumnya.
    const hapusNama = await apiCall<{ message: string }>(
      token,
      `/api/master-pengeluaran/nama/${namaUjiId}`,
      { method: "DELETE" },
    );
    expect(hapusNama.status).toBe(422);
    expect(hapusNama.body.message).toMatch(/Nonaktifkan/i);

    const hapusKategori = await apiCall<{ message: string }>(
      token,
      `/api/master-pengeluaran/kategori/${kategoriUjiId}`,
      { method: "DELETE" },
    );
    expect(hapusKategori.status).toBe(422);

    // Tombol Hapus-nya juga tidak dirender untuk baris yang terpakai.
    await login(page, "admin");
    await page.goto("/admin/pengeluaran");
    await page.getByTestId("cari-nama").fill(namaUji);
    await expect(page.getByTestId(`nama-row-${namaUjiId}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`hapus-nama-${namaUjiId}`)).toHaveCount(0);
    await expect(page.getByTestId(`status-nama-${namaUjiId}`)).toBeVisible();
  });

  test("FV-29: form Input Pengeluaran menyaring nama sesuai kategorinya", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/pembayaran");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    // Daftar namanya diambil ulang dari server tiap kategori berganti, jadi
    // isinya ditunggu, bukan dibaca sekali.
    const namaOptions = () =>
      page
        .getByLabel("Nama Pengeluaran *")
        .locator("option")
        .allTextContents()
        .then((t) => t.join("|"));

    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Bhikkhu/);
    await expect.poll(namaOptions, { timeout: 15_000 }).toContain("Bhikkhu");
    expect(await namaOptions()).not.toContain("Biaya ATK");

    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await expect.poll(namaOptions, { timeout: 15_000 }).toContain("Biaya ATK");
    expect(await namaOptions()).not.toContain("Biaya Catupacaya");
  });

  test("FV-29: izin — masters.view melihat, masters.manage mengubah", async () => {
    const bendahara = await apiToken("bendahara"); // masters.view saja
    expect((await apiCall(bendahara, "/api/master-pengeluaran/kategori")).status).toBe(200);

    const tolak = await apiCall(bendahara, "/api/master-pengeluaran/nama", {
      method: "POST",
      body: JSON.stringify({
        category: "biaya_operasional",
        name: "Biaya Nekat",
        coa_account_code: "6100",
      }),
    });
    expect(tolak.status).toBe(403);
  });
});
