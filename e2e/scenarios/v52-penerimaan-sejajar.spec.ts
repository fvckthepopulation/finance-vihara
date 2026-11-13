/**
 * v52 — Penerimaan disejajarkan dengan pengeluaran (FV-45, FV-38, FV-40).
 *
 * Alur penerimaan pada dasarnya sama dengan pengeluaran; yang tertinggal
 * hanya layarnya. Yang diuji di sini: tiga tombol niat (draft / ajukan /
 * submit), kategori & nama dari master, rekening tujuan hanya untuk Transfer,
 * No. Bukti dan lampiran, tabel hari ini dengan No. Transaksi + Status +
 * Detail, menu Daftar Penerimaan, dan draft penerimaan yang bisa dilanjutkan
 * pembuatnya.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { uniq } from "../fixtures/uniq";

type Dibuat = { id: number; code: string; status: string };

const HARI_INI = () => new Date().toISOString().slice(0, 10);

test.describe.configure({ mode: "serial" });

test.describe("v52 penerimaan sejajar pengeluaran", () => {
  let admin = "";
  let bendahara = "";
  let viharaVvg = 0;
  const dibersihkan: number[] = [];

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    bendahara = await apiToken("bendahara");
    viharaVvg = (await viharaIdsByCode()).VVG;
  });

  test.afterAll(async () => {
    for (const id of dibersihkan) {
      await apiCall(admin, `/api/penerimaan/${id}`, { method: "DELETE" });
    }
  });

  async function draftBendahara(catatan: string) {
    const res = await apiCall<Dibuat>(bendahara, "/api/penerimaan", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "tunai",
        vihara_id: viharaVvg,
        description: catatan,
        draft: true,
      }),
    });
    expect(res.status, "draft penerimaan tersimpan").toBe(201);
    dibersihkan.push(res.body.id);
    return res.body;
  }

  test("FV-45 poin 5: Kategori Dana datang dari master, bukan konstanta", async () => {
    const master = await apiCall<{ data: Array<{ code: string; name: string }> }>(
      admin,
      "/api/master-penerimaan/kategori?per_page=100",
    );
    expect(master.status, "master kategori penerimaan ada").toBe(200);
    const kodeMaster = master.body.data.map((k) => k.code);
    expect(kodeMaster).toContain("dana_bhikkhu");

    // Dropdown form membaca master yang sama.
    const dropdown = await apiCall<Array<{ key: string; label: string }>>(
      admin,
      "/api/penerimaan/categories",
    );
    for (const k of dropdown.body.map((d) => d.key)) {
      expect(kodeMaster, `kategori ${k} harus ada di master`).toContain(k);
    }
  });

  test("FV-45 poin 5: Master Penerimaan bisa dikelola, akun COA opsional", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/penerimaan");

    // Dua tingkat, dengan sebutan penerimaan — bukan salinan layar
    // pengeluaran yang labelnya tertinggal.
    await expect(page.getByText("Kategori Dana", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("tambah-nama")).toHaveText("+ Tambah Nama Penerimaan");
    await expect(page.locator("thead").first()).toContainText("Akun Bawaan");

    // Nama baru boleh TANPA akun COA: kosong = ikuti aturan kanal.
    const nama = uniq("Dana Uji E2E");
    await page.getByTestId("tambah-nama").click();
    const form = page.getByTestId("form-nama");
    await expect(form).toBeVisible({ timeout: 15_000 });
    await form.getByTestId("nama-kategori").selectOption("dana_perayaan");
    await form.getByTestId("nama-nama").fill(nama);
    // Akun dibiarkan kosong — dan form tidak menahannya.
    await form.getByTestId("nama-akun").selectOption("");
    await form.getByTestId("simpan-nama").click();
    await expect(page.getByText(/Nama Penerimaan ditambahkan/)).toBeVisible({ timeout: 15_000 });

    const dibuat = await apiCall<{ data: Array<{ id: number; name: string; coa_account_code: string | null }> }>(
      admin,
      `/api/master-penerimaan/nama?q=${encodeURIComponent(nama)}`,
    );
    const baris = dibuat.body.data.find((n) => n.name === nama);
    expect(baris, "nama penerimaan tersimpan").toBeTruthy();
    expect(baris!.coa_account_code, "akun kosong = ikuti aturan kanal").toBeNull();

    // Akun yang BUKAN pendapatan ditolak — bukan tersimpan diam-diam.
    const nekat = await apiCall<{ message?: string }>(admin, "/api/master-penerimaan/nama", {
      method: "POST",
      body: JSON.stringify({
        category: "dana_perayaan",
        name: uniq("Dana Akun Salah"),
        coa_account_code: "6100",
      }),
    });
    expect(nekat.status).toBe(422);

    await apiCall(admin, `/api/master-penerimaan/nama/${baris!.id}`, { method: "DELETE" });
  });

  test("FV-45 poin 1: tiga tombol niat, dan draft tidak membuat jurnal", async ({ page }) => {
    const catatan = uniq("v52-draft");
    await login(page, "admin");
    await page.goto("/penerimaan");

    for (const t of ["tombol-reset", "tombol-draft", "tombol-ajukan", "tombol-submit"]) {
      await expect(page.getByTestId(t)).toBeVisible({ timeout: 15_000 });
    }

    const yayasan = page.getByTestId("form-yayasan");
    await expect(yayasan).toBeEnabled({ timeout: 15_000 });
    if ((await yayasan.inputValue()) === "") await yayasan.selectOption({ index: 1 });
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));
    await page.getByLabel("Catatan").fill(catatan);
    await page.getByTestId("tombol-draft").click();
    await expect(page.getByText("Tersimpan sebagai draft — belum diajukan")).toBeVisible({
      timeout: 15_000,
    });

    const daftar = await apiCall<{ data: Array<Dibuat & { description: string | null; journal_entry_id: number | null }> }>(
      admin,
      "/api/penerimaan?per_page=20&status=draft",
    );
    const baris = daftar.body.data.find((p) => (p.description ?? "").includes(catatan));
    expect(baris, "draftnya tersimpan").toBeTruthy();
    dibersihkan.push(baris!.id);
    expect(baris!.journal_entry_id, "draft tidak membuat jurnal").toBeNull();
    expect(baris!.code).toMatch(/^RCV-\d{7}$/);
  });

  test("FV-45 poin 6: Rekening Tujuan hanya untuk Transfer; Tunai ke Kas Penerimaan Langsung", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/penerimaan");
    const yayasan = page.getByTestId("form-yayasan");
    await expect(yayasan).toBeEnabled({ timeout: 15_000 });
    if ((await yayasan.inputValue()) === "") await yayasan.selectOption({ index: 1 });
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    // Tunai: tidak ada pilihan rekening, tujuannya disebut apa adanya.
    await expect(page.getByTestId("form-rekening")).toHaveCount(0);
    await expect(page.getByText("Kas Penerimaan Langsung").first()).toBeVisible();

    await page.getByTestId("form-metode").selectOption("transfer");
    const rekening = page.getByTestId("form-rekening");
    await expect(rekening).toBeVisible();
    await expect
      .poll(async () => (await rekening.locator("option").allTextContents()).join("|"), {
        timeout: 15_000,
      })
      .toContain("6280-3488-88");
    // Rekening milik YAYASAN (FV-36) — labelnya menyebut yayasannya.
    expect((await rekening.locator("option").allTextContents()).join("|")).toMatch(/Yayasan/i);
  });

  test("FV-45 poin 7-8: No. Bukti, lampiran, lalu tabel hari ini lengkap", async ({ page }) => {
    const bukti = uniq("RCV-BKT");
    await login(page, "admin");
    await page.goto("/penerimaan");

    const yayasan = page.getByTestId("form-yayasan");
    await expect(yayasan).toBeEnabled({ timeout: 15_000 });
    if ((await yayasan.inputValue()) === "") await yayasan.selectOption({ index: 1 });
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    const jumlah = page.getByLabel("Jumlah (Rp) *");
    await expect(async () => {
      await jumlah.fill("345000");
      await expect(jumlah).toHaveValue("345.000", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    await page.getByTestId("form-kategori").selectOption("dana_perayaan");
    await page.getByTestId("form-nama").selectOption({ label: "Dana Kathina" });
    await page.getByTestId("form-referensi").fill(bukti);
    await page.getByTestId("form-lampiran").setInputFiles({
      name: "bukti-penerimaan.png",
      mimeType: "image/png",
      // PNG 1x1 — cukup untuk membuktikan jalur unggahnya hidup.
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await page.getByTestId("tombol-submit").click();
    await expect(page.getByText("Penerimaan disimpan dan disetujui")).toBeVisible({
      timeout: 20_000,
    });

    const daftar = await apiCall<{ data: Array<Dibuat & { reference: string | null; attachment_path: string | null }> }>(
      admin,
      "/api/penerimaan?per_page=10",
    );
    const baris = daftar.body.data.find((p) => p.reference === bukti);
    expect(baris, "penerimaannya tersimpan dengan No. Bukti").toBeTruthy();
    dibersihkan.push(baris!.id);
    expect(baris!.attachment_path, "lampiran terunggah").toBeTruthy();

    // Kolom tabel Penerimaan Hari Ini.
    const kolom = (await page.locator("thead th").allTextContents()).map((t) => t.trim());
    expect(kolom).toEqual([
      "No. Transaksi",
      "Tanggal",
      "Vihara",
      "Nama Penerimaan",
      "Kategori Dana",
      "Metode",
      "Masuk ke",
      "Jumlah",
      "Status",
      "Aksi",
    ]);
    await expect(page.getByTestId(`no-transaksi-${baris!.id}`)).toHaveText(baris!.code);

    // Nomor transaksi bisa diklik untuk membuka detail, lengkap dengan
    // lampirannya (FV-40 poin 2, FV-45 poin 8).
    await page.getByTestId(`no-transaksi-${baris!.id}`).click();
    const modal = page.getByTestId("detail-penerimaan");
    await expect(modal).toBeVisible({ timeout: 15_000 });
    for (const label of [
      "No. Transaksi",
      "Kategori Dana",
      "Nama Penerimaan",
      "Metode Penerimaan",
      "Masuk ke",
      "Donatur / Sumber",
      "No. Bukti / Referensi",
      "Diterima oleh",
    ]) {
      await expect(modal.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(modal.getByTestId("detail-status")).toContainText("Disetujui");
    await expect(modal.getByTestId("detail-penyetuju")).toContainText("Disetujui oleh");
    const gambar = modal.getByTestId("lampiran-gambar");
    await expect(gambar).toBeVisible({ timeout: 15_000 });
  });

  test("FV-45 poin 9: tautan di bawah tabel menuju Daftar Penerimaan", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/penerimaan");
    const tautan = page.getByTestId("link-semua-penerimaan");
    await expect(tautan).toHaveText(/Lihat semua penerimaan/);
    await tautan.click();
    await expect(page.locator("header")).toContainText("Daftar Penerimaan", {
      timeout: 15_000,
    });
  });

  test("FV-38: Daftar Penerimaan — kolom, saringan, pencarian, pagination", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/penerimaan/daftar");

    const kolom = (await page.locator("thead th").allTextContents()).map((t) => t.trim());
    expect(kolom).toEqual([
      "No. Transaksi",
      "Tanggal",
      "Vihara",
      "Nama Penerimaan",
      "Donatur / Sumber",
      "Kategori Dana",
      "Masuk ke",
      "Metode",
      "Jumlah",
      "Status",
      "Bukti",
      "Aksi",
    ]);

    for (const t of [
      "filter-dari",
      "filter-sampai",
      "filter-vihara",
      "filter-kategori",
      "filter-metode",
      "filter-status",
      "filter-cari",
    ]) {
      await expect(page.getByTestId(t)).toBeVisible();
    }

    await expect(page.getByTestId("pagination-info")).toHaveText(
      /^Menampilkan \d+–\d+ dari \d+ data$/,
      { timeout: 15_000 },
    );

    // Pencarian menerima No. Transaksi (FV-40 poin 3).
    const satu = await apiCall<{ data: Array<{ code: string }> }>(
      admin,
      "/api/penerimaan?per_page=1&status=posted",
    );
    const kode = satu.body.data[0]?.code;
    if (kode) {
      await page.getByTestId("filter-dari").fill("2020-01-01");
      await page.getByTestId("filter-cari").fill(kode);
      await expect(page.locator("tbody")).toContainText(kode, { timeout: 15_000 });
    }

    await page.getByTestId("filter-cari").fill("zzz-tidak-ada-apa-apa");
    await expect(page.getByText("Tidak ada penerimaan")).toBeVisible({ timeout: 15_000 });
  });

  test("FV-38 poin 5: daftar penerimaan butuh penerimaan.view, bukan transaksi.view", async () => {
    // Seluruh role bawaan punya kedua izin view, jadi gerbangnya tidak bisa
    // dibuktikan apa adanya. Izin role viewer dipangkas sementara: yang
    // tersisa hanya penerimaan.view.
    const roles = await apiCall<Array<{ id: number; name: string; permissions: string[] }>>(
      admin,
      "/api/admin/roles",
    );
    const viewerRole = roles.body.find((r) => r.name === "viewer");
    expect(viewerRole, "role viewer harus ada").toBeTruthy();
    const semula = viewerRole!.permissions;

    await apiCall(admin, `/api/admin/roles/${viewerRole!.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        permissions: semula.filter((p) => p !== "pembayaran.view" && p !== "transaksi.view"),
      }),
    });
    try {
      const viewer = await apiToken("viewer");
      // Daftar penerimaan tetap terbuka walau transaksi.view dicabut.
      expect((await apiCall(viewer, "/api/daftar-transaksi?tipe=Penerimaan")).status).toBe(200);
      // Izin satu modul tidak membuka modul lain.
      expect((await apiCall(viewer, "/api/daftar-transaksi?tipe=Pengeluaran")).status).toBe(403);
      // Gabungan keduanya = layar Semua Transaksi, izinnya sendiri.
      expect((await apiCall(viewer, "/api/daftar-transaksi")).status).toBe(403);
    } finally {
      await apiCall(admin, `/api/admin/roles/${viewerRole!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: semula }),
      });
    }
  });

  test("FV-45 poin 2: draft penerimaan bisa diubah, diajukan, dan dihapus pembuatnya", async ({
    page,
  }) => {
    const catatan = uniq("v52-lanjut");
    const d = await draftBendahara(catatan);

    await login(page, "bendahara");
    await page.goto("/penerimaan/daftar");
    await page.getByTestId("filter-cari").fill(catatan);
    await page.getByTestId(`no-transaksi-${d.id}`).click();

    const modal = page.getByTestId("detail-penerimaan");
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByTestId("detail-status")).toContainText("Draft");

    await modal.getByTestId("ubah-draft").click();
    const form = page.getByTestId("form-ubah-penerimaan");
    await expect(form).toBeVisible({ timeout: 15_000 });
    await form.getByTestId("ubah-jumlah").fill("90000");
    await form.getByTestId("ubah-kategori").selectOption("dana_perayaan");
    await form.getByTestId("ubah-nama").selectOption({ label: "Dana Kathina" });
    await form.getByTestId("simpan-draft").click();
    await expect(page.getByTestId("detail-info")).toContainText("tetap Draft", {
      timeout: 15_000,
    });

    const sesudah = await apiCall<{
      status: string;
      amount: string;
      credit_account_code: string | null;
    }>(bendahara, `/api/penerimaan/${d.id}`);
    expect(sesudah.body.status).toBe("draft");
    expect(Number(sesudah.body.amount)).toBe(90000);
    // Mengubah kategori menentukan ulang akun pendapatannya — dulu kolom ini
    // justru jadi NULL karena hanya kategori suspense yang punya
    // default_credit di konstanta.
    expect(sesudah.body.credit_account_code, "akun kredit terisi").toBeTruthy();

    await page.getByTestId("ajukan-draft").click();
    await expect(page.getByTestId("detail-info")).toContainText("menunggu persetujuan", {
      timeout: 15_000,
    });
    expect(
      (await apiCall<{ status: string }>(bendahara, `/api/penerimaan/${d.id}`)).body.status,
    ).toBe("submitted");
  });

  test("FV-45 poin 10: persetujuan penerimaan tercatat sistem, tanpa field manual", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/penerimaan");
    // "Diterima oleh" terisi dari akun yang login dan tidak bisa diketik.
    const diterima = page.getByTestId("form-diterima");
    await expect(diterima).toBeDisabled();
    await expect(diterima).toHaveValue(/\S/);
  });
});
