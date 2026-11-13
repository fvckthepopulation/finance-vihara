/**
 * v53 — Kerapian yang dikeluhkan penguji: grup sidebar (FV-37), modal master
 * (FV-39), kolom aksi jurnal (FV-41), tombol tambah Master Pengeluaran
 * (FV-42), dan nomor/kode yang tidak lagi monospace (FV-43).
 *
 * Semuanya keluhan tampilan, jadi yang diuji memang yang bisa dilihat:
 * jarak dalam modal yang sama dengan judulnya, tombol yang tidak terpecah
 * dua baris, posisi tombol Detail yang sama di setiap baris, dan font angka
 * yang bukan monospace.
 */
import { test, expect, Locator } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";

/** Jarak kiri sebuah elemen terhadap panel modal pembungkusnya. */
async function jarakKiri(el: Locator, panel: Locator): Promise<number> {
  const a = await el.boundingBox();
  const b = await panel.boundingBox();
  if (!a || !b) throw new Error("elemen tidak terlihat");
  return Math.round(a.x - b.x);
}

test.describe.configure({ mode: "serial" });

test.describe("v53 kerapian sidebar & modal", () => {
  test("FV-37: Transaksi berisi grup Penerimaan & Pengeluaran, urut, bisa ditutup", async ({
    page,
  }) => {
    await login(page, "admin");
    const aside = page.locator("aside").first();

    const grupPenerimaan = aside.getByTestId("grup-penerimaan");
    const grupPengeluaran = aside.getByTestId("grup-pengeluaran");
    await expect(grupPenerimaan).toBeVisible({ timeout: 15_000 });
    await expect(grupPengeluaran).toBeVisible();

    // Isinya, dan urutan di dalam grup.
    await expect(aside.locator('a[href="/penerimaan/daftar"]')).toBeVisible();
    await expect(aside.locator('a[href="/penerimaan"]')).toBeVisible();
    await expect(aside.locator('a[href="/pengeluaran"]')).toBeVisible();
    await expect(aside.locator('a[href="/pembayaran"]')).toBeVisible();

    // Urutan bagian Transaksi: dua grup dulu, lalu Persetujuan dst.
    const y = async (l: Locator) => (await l.boundingBox())!.y;
    expect(await y(grupPenerimaan)).toBeLessThan(await y(grupPengeluaran));
    expect(await y(grupPengeluaran)).toBeLessThan(
      await y(aside.locator('a[href="/persetujuan"]').first()),
    );
    expect(await y(aside.locator('a[href="/persetujuan"]').first())).toBeLessThan(
      await y(aside.locator('a[href="/riwayat"]').first()),
    );

    // Bisa ditutup, dan isinya ikut hilang.
    await grupPengeluaran.click();
    await expect(aside.locator('a[href="/pembayaran"]')).toHaveCount(0);
    await grupPengeluaran.click();
    await expect(aside.locator('a[href="/pembayaran"]')).toBeVisible();

    // Grup yang isinya sedang aktif dipaksa terbuka, dan menu aktif tersorot.
    await page.goto("/pembayaran");
    await expect(aside.locator('a[href="/pembayaran"]')).toBeVisible({ timeout: 15_000 });
    await grupPengeluaran.click();
    await expect(
      aside.locator('a[href="/pembayaran"]'),
      "menu halaman yang sedang dibuka tidak boleh disembunyikan",
    ).toBeVisible();
  });

  test("FV-37 poin 5: grup hilang kalau seluruh isinya tidak boleh diakses", async ({ page }) => {
    // Seluruh role bawaan boleh melihat kedua modul, jadi izin role viewer
    // dipangkas sementara untuk membuktikan grupnya ikut hilang — bukan
    // tampil sebagai grup kosong yang bisa diklik.
    const admin = await apiToken("admin");
    const roles = await apiCall<Array<{ id: number; name: string; permissions: string[] }>>(
      admin,
      "/api/admin/roles",
    );
    const viewer = roles.body.find((r) => r.name === "viewer")!;
    const semula = viewer.permissions;

    await apiCall(admin, `/api/admin/roles/${viewer.id}`, {
      method: "PATCH",
      body: JSON.stringify({ permissions: semula.filter((p) => p !== "penerimaan.view") }),
    });
    try {
      await login(page, "viewer");
      const aside = page.locator("aside").first();
      await expect(aside.getByTestId("grup-pengeluaran")).toBeVisible({ timeout: 15_000 });
      await expect(aside.getByTestId("grup-penerimaan")).toHaveCount(0);
      await expect(aside.locator('a[href="/penerimaan/daftar"]')).toHaveCount(0);
    } finally {
      await apiCall(admin, `/api/admin/roles/${viewer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: semula }),
      });
    }
  });

  test("FV-39: isi modal master sejajar judulnya, tombol berjarak di kanan", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/penerima");
    await page.getByTestId("tambah-penerima").click();

    const panel = page.getByTestId("form-penerima-master").locator("form");
    await expect(panel).toBeVisible({ timeout: 15_000 });

    const judul = panel.getByRole("heading", { name: "Tambah Penerima" });
    const labelNama = panel.getByText("Nama *", { exact: true });
    const jarakJudul = await jarakKiri(judul, panel);
    const jarakLabel = await jarakKiri(labelNama, panel);
    // Sejajar: selisihnya boleh 1px karena pembulatan, bukan 16px.
    expect(Math.abs(jarakJudul - jarakLabel), "label sejajar dengan judul").toBeLessThanOrEqual(2);
    expect(jarakLabel, "isi tidak menempel ke tepi modal").toBeGreaterThan(8);

    // Tombol: Batal lalu Simpan, di kanan, dengan jarak di antaranya.
    const batal = panel.getByRole("button", { name: "Batal" });
    const simpan = panel.getByTestId("simpan-penerima");
    const kotakBatal = (await batal.boundingBox())!;
    const kotakSimpan = (await simpan.boundingBox())!;
    expect(kotakBatal.x, "Batal di kiri Simpan").toBeLessThan(kotakSimpan.x);
    const celah = kotakSimpan.x - (kotakBatal.x + kotakBatal.width);
    expect(celah, "ada jarak antara Batal dan Simpan").toBeGreaterThanOrEqual(4);
    const kotakPanel = (await panel.boundingBox())!;
    const sisaKanan = kotakPanel.x + kotakPanel.width - (kotakSimpan.x + kotakSimpan.width);
    expect(sisaKanan, "tombol rata kanan dengan jarak dalam").toBeGreaterThan(8);
    expect(sisaKanan).toBeLessThan(40);
  });

  test("FV-39: modal lain yang memakai komponen sama tetap rapi", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/roles");
    // Modal Role baru jadi acuan penguji — perbaikan komponen tidak boleh
    // merusaknya: keterangan tetap di kiri, tombol tetap di kanan.
    await page.getByRole("button", { name: "+ Role baru" }).click();
    const simpan = page.getByTestId("role-simpan");
    await expect(simpan).toBeVisible({ timeout: 15_000 });
    const keterangan = page.getByText(/dari \d+ permission dipilih/);
    await expect(keterangan).toBeVisible();
    const kiri = (await keterangan.boundingBox())!;
    const kanan = (await simpan.boundingBox())!;
    expect(kiri.x, "keterangan di kiri, tombol di kanan").toBeLessThan(kanan.x);
  });

  test("FV-42: tombol tambah Master Pengeluaran satu baris, setinggi kolom cari", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/admin/pengeluaran");

    for (const [tombol, label, cari] of [
      ["tambah-kategori", "+ Tambah Kategori", "cari-kategori"],
      ["tambah-nama", "+ Tambah Nama Pengeluaran", "cari-nama"],
    ] as const) {
      const t = page.getByTestId(tombol);
      await expect(t).toHaveText(label, { timeout: 15_000 });
      const kotak = (await t.boundingBox())!;
      // Satu baris: tingginya tidak sampai dua kali tinggi teks.
      expect(kotak.height, `${tombol} tidak terpecah dua baris`).toBeLessThan(44);
      const kotakCari = (await page.getByTestId(cari).boundingBox())!;
      expect(
        Math.abs(kotak.height - kotakCari.height),
        `${tombol} setinggi kolom cari`,
      ).toBeLessThanOrEqual(3);
      expect(
        Math.abs(kotak.y - kotakCari.y),
        `${tombol} sejajar vertikal dengan kolom cari`,
      ).toBeLessThanOrEqual(3);
    }
  });

  test("FV-41: kolom Aksi jurnal berjudul, tombol Detail sejajar di semua baris", async ({
    page,
  }) => {
    const admin = await apiToken("admin");
    const viharaVvg = (await viharaIdsByCode()).VVG;
    const viharas = await apiCall<{ data: Array<{ id: number; entity_id: number }> }>(
      admin,
      "/api/viharas?per_page=100",
    );
    const entityVvg = viharas.body.data.find((v) => v.id === viharaVvg)!.entity_id;

    // Perlu dua macam baris: jurnal posted (aksi kedua "Transaksi") dan
    // jurnal manual draft (aksi kedua "Hapus"). Tanpa keduanya, keluhan
    // "posisinya berpindah" tidak bisa dibuktikan.
    const je = await apiCall<{ id: number }>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify({
        entity_id: entityVvg,
        entry_date: new Date().toISOString().slice(0, 10),
        vihara_id: viharaVvg,
        description: "v53 — jurnal draft untuk uji kolom aksi",
        lines: [
          { account_code: "1120", debit: 10000, credit: 0 },
          { account_code: "3100", debit: 0, credit: 10000 },
        ],
      }),
    });
    expect(je.status, "jurnal draft dibuat").toBe(201);

    try {
      await login(page, "admin");
      await page.goto("/jurnal");

      const kolom = (await page.locator("thead th").allTextContents()).map((t) => t.trim());
      expect(kolom[kolom.length - 1], "kolom aksi berjudul").toBe("Aksi");

      const tombolDetail = page.locator('[data-testid^="detail-je-"]');
      await expect(tombolDetail.first()).toBeVisible({ timeout: 15_000 });
      const jumlah = Math.min(await tombolDetail.count(), 8);
      expect(jumlah, "perlu beberapa baris untuk dibandingkan").toBeGreaterThan(1);

      const x: number[] = [];
      for (let i = 0; i < jumlah; i++) {
        x.push((await tombolDetail.nth(i).boundingBox())!.x);
      }
      // Sejajar: selisih posisi antar baris di bawah satu piksel penuh.
      expect(Math.max(...x) - Math.min(...x), "Detail sejajar di semua baris").toBeLessThanOrEqual(1);

      // Aksi kedua pun tombol, bukan teks bergaris bawah, dan tidak menempel
      // ke tepi tabel.
      const hapus = page.getByTestId(`hapus-je-${je.body.id}`);
      await expect(hapus).toBeVisible();
      const tabel = (await page.locator("table").first().boundingBox())!;
      const kotakHapus = (await hapus.boundingBox())!;
      expect(
        tabel.x + tabel.width - (kotakHapus.x + kotakHapus.width),
        "aksi tidak menempel ke tepi kanan tabel",
      ).toBeGreaterThan(4);
    } finally {
      await apiCall(admin, `/api/journal-entries/${je.body.id}`, { method: "DELETE" });
    }
  });

  test("FV-43: nomor transaksi & kode akun memakai font utama, tabular", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/jurnal");

    const kode = page.locator(".kode").first();
    await expect(kode).toBeVisible({ timeout: 15_000 });

    const gaya = await kode.evaluate((el) => {
      const s = getComputedStyle(el);
      return { font: s.fontFamily, angka: s.fontVariantNumeric };
    });
    expect(gaya.font, "bukan monospace lagi").not.toMatch(/mono/i);
    expect(gaya.angka, "angka berlebar sama").toContain("tabular-nums");

    // Dan di menu lain yang disebut penguji.
    for (const path of ["/riwayat", "/pengeluaran", "/admin/coa", "/admin/pengeluaran"]) {
      await page.goto(path);
      const el = page.locator(".kode").first();
      await expect(el).toBeVisible({ timeout: 15_000 });
      const font = await el.evaluate((n) => getComputedStyle(n).fontFamily);
      expect(font, `${path} masih monospace`).not.toMatch(/mono/i);
    }
  });
});
