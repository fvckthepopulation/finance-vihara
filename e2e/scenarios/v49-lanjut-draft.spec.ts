/**
 * v49 — Melanjutkan draft pengeluaran (FV-44).
 *
 * Draft yang tersimpan tapi tidak bisa diapa-apakan sama saja dengan hilang:
 * pembuatnya harus menginput ulang dari awal, dan draft lama menumpuk di
 * daftar tanpa bisa dibersihkan. Yang diuji di sini ketiga jalan keluarnya —
 * Ubah, Hapus, Ajukan Persetujuan — berikut siapa yang boleh memakainya.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { rekeningPengeluaran } from "../fixtures/rekening";
import { uniq } from "../fixtures/uniq";

type Dibuat = { id: number; code: string; status: string };

test.describe.configure({ mode: "serial" });

test.describe("v49 lanjut draft", () => {
  let admin = "";
  let bendahara = "";
  let viharaVvg = 0;
  const dibersihkan: number[] = [];

  /** Draft milik BENDAHARA VVG — pembuatnya jelas, bukan admin. */
  async function draftBendahara(catatan: string) {
    const res = await apiCall<Dibuat>(bendahara, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        method: "transfer",
        vihara_id: viharaVvg,
        description: catatan,
        draft: true,
      }),
    });
    expect(res.status, "draft tersimpan").toBe(201);
    dibersihkan.push(res.body.id);
    return res.body;
  }

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    bendahara = await apiToken("bendahara");
    viharaVvg = (await viharaIdsByCode()).VVG;
  });

  test.afterAll(async () => {
    for (const id of dibersihkan) {
      await apiCall(admin, `/api/pembayaran/${id}`, { method: "DELETE" });
    }
  });

  test("FV-44: draft punya nomor transaksi sejak disimpan", async () => {
    const d = await draftBendahara(uniq("v49-nomor"));
    expect(d.status).toBe("draft");
    // Nomornya ada sejak draft, jadi draft pun bisa dirujuk (FV-40 poin 5).
    expect(d.code).toMatch(/^PAY-\d{7}$/);
  });

  test("FV-44: pembuatnya melihat Ubah, Hapus, dan Ajukan Persetujuan", async ({ page }) => {
    const catatan = uniq("v49-tombol");
    const d = await draftBendahara(catatan);

    await login(page, "bendahara");
    await page.goto("/pengeluaran");
    await page.getByTestId("filter-cari").fill(catatan);
    await page.getByTestId(`no-transaksi-${d.id}`).click();

    const modal = page.getByTestId("detail-pengeluaran");
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByTestId("detail-status")).toContainText("Draft");
    for (const t of ["ubah-draft", "hapus-draft", "ajukan-draft"]) {
      await expect(modal.getByTestId(t)).toBeVisible();
    }
    // No. Transaksi ikut tampil di detail (FV-40 poin 4).
    await expect(modal).toContainText(d.code);
  });

  test("FV-46: Ubah membuka FORM Input Pengeluaran berisi draft; nomornya tetap", async ({
    page,
  }) => {
    const catatan = uniq("v49-ubah");
    const d = await draftBendahara(catatan);

    await login(page, "bendahara");
    await page.goto("/pengeluaran");
    await page.getByTestId("filter-cari").fill(catatan);
    await page.getByTestId(`no-transaksi-${d.id}`).click();
    await page.getByTestId("ubah-draft").click();

    // Halaman penuh, bukan modal — dan judulnya menyebut draftnya.
    await page.waitForURL(`**/pembayaran?draft=${d.id}`);
    await expect(page.locator("header")).toContainText(`Ubah Draft ${d.code}`, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("form-ubah-pengeluaran")).toHaveCount(0);

    // Field, urutan, dan tanda wajibnya sama persis dengan form input baru
    // (FV-46 poin 3) — termasuk Metode Pembayaran, yang dulu hilang di modal.
    for (const label of [
      "Tanggal *",
      "Jumlah (Rp) *",
      "Kategori Biaya *",
      "Nama Pengeluaran *",
      "Metode Pembayaran *",
      "Transfer dari Rekening *",
      "Dibayarkan kepada / PIC",
      "No. Bukti / Referensi",
      "Catatan",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // Isian draft sudah terisi, dan Yayasan/Vihara terkunci (poin 2 & 5).
    await expect(page.getByTestId("form-vihara")).toBeDisabled();
    await expect(page.getByTestId("form-yayasan")).toBeDisabled();
    await expect(page.getByLabel("Catatan")).toHaveValue(catatan);

    // Tombolnya mengikuti izin user (poin 4). Bendahara boleh mencatat dan
    // mengajukan, tapi TIDAK menyetujui — jadi Submit memang tidak ada.
    for (const t of ["tombol-batal", "tombol-draft", "tombol-ajukan"]) {
      await expect(page.getByTestId(t)).toBeVisible();
    }
    await expect(page.getByTestId("tombol-submit")).toHaveCount(0);

    const bukti = uniq("BKT");
    const jumlah = page.getByLabel("Jumlah (Rp) *");
    await expect(async () => {
      await jumlah.fill("250000");
      await expect(jumlah).toHaveValue("250.000", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await page.getByLabel("No. Bukti / Referensi").fill(bukti);
    await page.getByTestId("tombol-draft").click();

    // Kembali ke daftar, baris yang SAMA diperbarui — bukan transaksi baru
    // dengan nomor baru (poin 6).
    await page.waitForURL("**/pengeluaran");
    const sesudah = await apiCall<{ status: string; amount: string; reference: string; code: string }>(
      bendahara,
      `/api/pembayaran/${d.id}`,
    );
    expect(sesudah.body.status, "status tetap draft").toBe("draft");
    expect(sesudah.body.code, "nomor transaksinya tetap").toBe(d.code);
    expect(Number(sesudah.body.amount)).toBe(250000);
    expect(sesudah.body.reference).toBe(bukti);
  });

  test("FV-44: Ajukan Persetujuan menegakkan kelengkapan, lalu memindahkan status", async ({
    page,
  }) => {
    const catatan = uniq("v49-ajukan");
    const d = await draftBendahara(catatan);

    await login(page, "bendahara");
    await page.goto("/pengeluaran");
    await page.getByTestId("filter-cari").fill(catatan);
    await page.getByTestId(`no-transaksi-${d.id}`).click();

    // Draft ini masih setengah jadi: pengajuannya ditolak dengan sebutan
    // yang kurang, bukan diterima diam-diam.
    await page.getByTestId("ajukan-draft").click();
    await expect(page.getByTestId("detail-pengeluaran")).toContainText(
      /wajib diisi sebelum diajukan/i,
      { timeout: 15_000 },
    );

    // Dilengkapi lewat API (bagian formnya sudah diuji di atas), lalu diajukan.
    const rekPengeluaran = await rekeningPengeluaran(bendahara, viharaVvg);
    await apiCall(bendahara, `/api/pembayaran/${d.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        amount: 150000,
        category: "biaya_operasional",
        name: "Biaya ATK",
        bank_account_id: rekPengeluaran,
      }),
    });

    await page.reload();
    await page.getByTestId("filter-cari").fill(catatan);
    await page.getByTestId(`no-transaksi-${d.id}`).click();
    await page.getByTestId("ajukan-draft").click();
    await expect(page.getByTestId("detail-info")).toContainText("menunggu persetujuan", {
      timeout: 15_000,
    });

    const sesudah = await apiCall<{ status: string }>(bendahara, `/api/pembayaran/${d.id}`);
    expect(sesudah.body.status).toBe("submitted");

    // Sesudah diajukan, Ubah dan Hapus tidak lagi tersedia (poin 6).
    await expect(page.getByTestId("ubah-draft")).toHaveCount(0);
    await expect(page.getByTestId("hapus-draft")).toHaveCount(0);
  });

  test("FV-44: Hapus membuang draft, dan tidak ada jurnal yang perlu dibalik", async ({
    page,
  }) => {
    const catatan = uniq("v49-hapus");
    const d = await draftBendahara(catatan);

    await login(page, "bendahara");
    await page.goto("/pengeluaran");
    await page.getByTestId("filter-cari").fill(catatan);
    await page.getByTestId(`no-transaksi-${d.id}`).click();

    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("tidak bisa dibatalkan");
      dialog.accept();
    });
    await page.getByTestId("hapus-draft").click();

    await expect(page.getByTestId("detail-pengeluaran")).toHaveCount(0, { timeout: 15_000 });
    const sesudah = await apiCall(bendahara, `/api/pembayaran/${d.id}`);
    expect(sesudah.status, "barisnya benar-benar hilang").toBe(404);

    // Draft belum pernah membuat jurnal, jadi tidak ada jurnal pembalik.
    // Nomor dokumennya ikut tertulis di deskripsi jurnal, jadi pencarian itu
    // yang dipakai — bukan membaca seluruh buku besar.
    const jurnal = await apiCall<{ data: unknown[] }>(
      admin,
      `/api/journal-entries?source=pembayaran&q=${encodeURIComponent(d.code)}`,
    );
    expect(jurnal.body.data.length, "tidak ada jurnal untuk draft yang dihapus").toBe(0);
  });

  test("FV-44: user lain hanya melihat — tombolnya tidak ada, API-nya 403", async ({ page }) => {
    const catatan = uniq("v49-orang-lain");
    const d = await draftBendahara(catatan);

    // bendaharaMulti memegang VVG juga DAN punya izin mencatat — jadi yang
    // membedakannya dari pembuat draft ini memang cuma kepemilikan, bukan
    // izin maupun jangkauan vihara. Boleh MELIHAT draftnya...
    const rekanSevihara = await apiToken("bendaharaMulti");
    expect((await apiCall(rekanSevihara, `/api/pembayaran/${d.id}`)).status).toBe(200);

    // ...tapi tidak boleh mengubah, menghapus, atau mengajukannya.
    for (const [path, init] of [
      [`/api/pembayaran/${d.id}`, { method: "PATCH", body: JSON.stringify({ amount: 1 }) }],
      [`/api/pembayaran/${d.id}`, { method: "DELETE" }],
      [`/api/pembayaran/${d.id}/submit`, { method: "POST" }],
    ] as const) {
      const res = await apiCall<{ message?: string }>(rekanSevihara, path, init);
      expect(res.status, `${init.method} ${path} harus 403`).toBe(403);
      expect(res.body.message ?? "").toMatch(/pembuat draft/i);
    }

    // Dan di layarnya pun tombol lanjut draft tidak dirender.
    await login(page, "bendaharaMulti");
    await page.goto("/pengeluaran");
    await page.getByTestId("filter-cari").fill(catatan);
    await page.getByTestId(`no-transaksi-${d.id}`).click();
    await expect(page.getByTestId("detail-pengeluaran")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("ubah-draft")).toHaveCount(0);
    await expect(page.getByTestId("hapus-draft")).toHaveCount(0);
    await expect(page.getByTestId("ajukan-draft")).toHaveCount(0);
  });

  test("FV-44: superadmin tetap bisa melanjutkan draft orang lain", async () => {
    const d = await draftBendahara(uniq("v49-superadmin"));

    const res = await apiCall<{ reference: string }>(admin, `/api/pembayaran/${d.id}`, {
      method: "PATCH",
      body: JSON.stringify({ reference: "OLEH-SUPERADMIN" }),
    });
    expect(res.status).toBe(200);
    expect(res.body.reference).toBe("OLEH-SUPERADMIN");
  });
});
