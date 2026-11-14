/**
 * v47 — Master Penerima (FV-31).
 *
 * Field "Dibayarkan kepada / PIC" adalah teks bebas, jadi penerima yang sama
 * tertulis berbeda-beda ("Fotocopy", "fotocopy", "Toko Fotocopy") dan rekap
 * per penerima mustahil. Sekarang ada masternya, dengan dua syarat yang tidak
 * boleh hilang: isian bebas tetap sah, dan nama yang sama persis (tanpa
 * membedakan huruf besar/kecil) tidak pernah jadi dua baris.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { rekeningPengeluaran } from "../fixtures/rekening";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

type Dibuat = { id: number };

test.describe.configure({ mode: "serial" });

test.describe("v47 master penerima", () => {
  let token = "";
  let viharaVvg = 0;
  let rekening = 0;
  const vendor = uniq("Vendor E2E");
  let vendorId = 0;
  const penerimaDibuat: number[] = [];
  const pembayaranDibuat: number[] = [];

  test.beforeAll(async () => {
    token = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
    // Pengeluaran keluar dari Bank Operasional (1120) sejak FV-56.
    rekening = await rekeningPengeluaran(token, viharaVvg);
  });

  test.afterAll(async () => {
    for (const id of pembayaranDibuat) {
      await apiCall(token, `/api/pembayaran/${id}`, { method: "DELETE" });
    }
    for (const id of penerimaDibuat) {
      await apiCall(token, `/api/penerima/${id}`, { method: "DELETE" });
    }
  });

  test("FV-31: layar master punya pencarian & pagination", async ({ page }) => {
    const dibuat = await apiCall<Dibuat>(token, "/api/penerima", {
      method: "POST",
      body: JSON.stringify({
        name: vendor,
        type: "vendor",
        phone: "0812-0000-0000",
        bank_name: "BCA",
        bank_account_number: "123-456",
        bank_account_holder: vendor,
        npwp: "01.234.567.8-999.000",
      }),
    });
    expect(dibuat.status).toBe(201);
    vendorId = dibuat.body.id;
    penerimaDibuat.push(vendorId);

    await login(page, "admin");
    await page.goto("/admin/penerima");

    await expect(page.getByTestId("pagination-info")).toHaveText(
      /^Menampilkan 1–\d+ dari \d+ data$/,
      { timeout: 15_000 },
    );
    await page.getByTestId("cari-penerima").fill(vendor);
    await expect(page.getByTestId(`penerima-row-${vendorId}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("tbody")).toContainText("123-456");

    await page.getByTestId("cari-penerima").fill("zzz-tidak-ada");
    await expect(page.getByText("Data tidak ditemukan")).toBeVisible({ timeout: 15_000 });
  });

  test("FV-31: saran muncul saat mengetik, tanpa membedakan huruf besar/kecil", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/pembayaran");

    // Potongan kata di tengah nama, huruf kecil semua.
    const potongan = vendor.slice(0, 8).toLowerCase();
    await page.getByTestId("form-penerima").fill(potongan);
    await expect(page.getByTestId("saran-penerima")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId(`saran-penerima-${vendorId}`).click();

    await expect(page.getByTestId("form-penerima")).toHaveValue(vendor);
    // Tanda bahwa isian ini terkait ke baris master, bukan teks lepas.
    await expect(page.getByTestId("penerima-terkait")).toBeVisible();
  });

  test("FV-31: memilih dari master menyimpan kaitannya di transaksi", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/pembayaran");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    const bukti = uniq("E2E-PNR");
    await page.getByLabel("Jumlah (Rp) *").fill("31000");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await selectByLabelRegex(page.getByLabel("Nama Pengeluaran *"), /Biaya ATK/);
    await selectByLabelRegex(page.getByTestId("form-rekening"), /Mandiri/);
    await page.getByTestId("form-penerima").fill(vendor.slice(0, 8).toLowerCase());
    await expect(page.getByTestId("saran-penerima")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId(`saran-penerima-${vendorId}`).click();
    await page.getByLabel("No. Bukti / Referensi").fill(bukti);
    await page.getByTestId("tombol-submit").click();
    await expect(page.getByText(/disimpan dan disetujui/)).toBeVisible({ timeout: 15_000 });

    const daftar = await apiCall<{
      data: Array<{ id: number; reference: string | null; payee_id: number | null; payee_name: string }>;
    }>(token, "/api/pembayaran?per_page=5");
    const baris = daftar.body.data.find((p) => p.reference === bukti);
    expect(baris, "transaksinya harus ada").toBeTruthy();
    pembayaranDibuat.push(baris!.id);
    expect(baris!.payee_id, "kaitan ke master ikut tersimpan").toBe(vendorId);
    expect(baris!.payee_name).toBe(vendor);
  });

  test("FV-31: nama bebas di luar master tetap bisa disimpan", async () => {
    const bebas = uniq("Warung Bebas");
    const res = await apiCall<Dibuat & { payee_id: number | null; payee_name: string }>(
      token,
      "/api/pembayaran",
      {
        method: "POST",
        body: JSON.stringify({
          date: new Date().toLocaleDateString("en-CA"),
          method: "transfer",
          category: "biaya_operasional",
          name: "Biaya ATK",
          amount: 5000,
          vihara_id: viharaVvg,
          bank_account_id: rekening,
          payee_name: bebas,
        }),
      },
    );
    expect(res.status).toBe(201);
    pembayaranDibuat.push(res.body.id);
    expect(res.body.payee_name).toBe(bebas);
    // Model yang baru dibuat tidak menyertakan atribut yang tidak diisi,
    // jadi "tidak terkait master" berarti null ATAU tidak ada.
    expect(res.body.payee_id ?? null).toBeNull();

    // Dan nama itu memang belum masuk master.
    const cari = await apiCall<{ data: Array<{ name: string }> }>(
      token,
      `/api/penerima/suggest?q=${encodeURIComponent(bebas)}`,
    );
    expect(cari.body.data.length).toBe(0);
  });

  test("FV-31: '+ Tambahkan ke master' memasukkan nama baru lalu mengaitkannya", async ({
    page,
  }) => {
    const baru = uniq("Toko Baru");
    await login(page, "admin");
    await page.goto("/pembayaran");

    await page.getByTestId("form-penerima").fill(baru);
    const tombol = page.getByTestId("tambah-penerima-master");
    await expect(tombol).toBeVisible({ timeout: 15_000 });
    await expect(tombol).toHaveText(new RegExp(`Tambahkan "${baru}" ke master`));
    await tombol.click();

    await expect(page.getByTestId("penerima-terkait")).toBeVisible({ timeout: 15_000 });

    const cari = await apiCall<{ data: Array<{ id: number; name: string }> }>(
      token,
      `/api/penerima/suggest?q=${encodeURIComponent(baru)}`,
    );
    const dibuat = cari.body.data.find((p) => p.name === baru);
    expect(dibuat, "nama baru masuk master").toBeTruthy();
    penerimaDibuat.push(dibuat!.id);
  });

  test("FV-31: nama sama persis tidak membuat baris kedua", async () => {
    const sebelum = await apiCall<{ total: number }>(token, "/api/penerima?per_page=1");

    // Huruf besar-kecil berbeda, isinya sama.
    const lagi = await apiCall<{ id: number; sudah_ada?: boolean }>(token, "/api/penerima/cepat", {
      method: "POST",
      body: JSON.stringify({ name: vendor.toUpperCase() }),
    });
    expect(lagi.body.id).toBe(vendorId);
    expect(lagi.body.sudah_ada).toBe(true);

    const sesudah = await apiCall<{ total: number }>(token, "/api/penerima?per_page=1");
    expect(sesudah.body.total).toBe(sebelum.body.total);

    // Lewat layar master pun ditolak, dengan pesannya.
    const tolak = await apiCall<{ message: string }>(token, "/api/penerima", {
      method: "POST",
      body: JSON.stringify({ name: vendor.toLowerCase(), type: "vendor" }),
    });
    expect(tolak.status).toBe(422);
    expect(tolak.body.message).toContain("sudah ada");
  });

  test("FV-31: penerima terpakai hanya bisa dinonaktifkan, dan tidak lagi disarankan", async ({
    page,
  }) => {
    const hapus = await apiCall<{ message: string }>(token, `/api/penerima/${vendorId}`, {
      method: "DELETE",
    });
    expect(hapus.status).toBe(422);
    expect(hapus.body.message).toMatch(/Nonaktifkan/i);

    await apiCall(token, `/api/penerima/${vendorId}`, {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });
    const saran = await apiCall<{ data: Array<{ id: number }> }>(
      token,
      `/api/penerima/suggest?q=${encodeURIComponent(vendor.slice(0, 8))}`,
    );
    expect(saran.body.data.some((p) => p.id === vendorId), "nonaktif tidak disarankan").toBe(false);

    await login(page, "admin");
    await page.goto("/admin/penerima");
    await page.getByTestId("cari-penerima").fill(vendor);
    await expect(page.getByTestId(`penerima-row-${vendorId}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`hapus-penerima-${vendorId}`)).toHaveCount(0);

    await apiCall(token, `/api/penerima/${vendorId}`, {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
  });

  test("FV-31: izin — pencatat boleh menambah, mengubah master butuh masters.manage", async () => {
    const bendahara = await apiToken("bendahara"); // pembayaran.create + masters.view
    const nama = uniq("Dari Bendahara");
    const cepat = await apiCall<Dibuat>(bendahara, "/api/penerima/cepat", {
      method: "POST",
      body: JSON.stringify({ name: nama }),
    });
    expect(cepat.status).toBe(201);
    penerimaDibuat.push(cepat.body.id);

    // Tapi layar masternya tetap terjaga.
    const ubah = await apiCall(bendahara, `/api/penerima/${cepat.body.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: `${nama} diubah` }),
    });
    expect(ubah.status).toBe(403);

    const viewer = await apiToken("viewer"); // tanpa pembayaran.create
    const tolak = await apiCall(viewer, "/api/penerima/cepat", {
      method: "POST",
      body: JSON.stringify({ name: uniq("Nekat") }),
    });
    expect(tolak.status).toBe(403);
  });

  test("FV-31: master milik yayasan — yayasan lain tidak melihatnya", async () => {
    // Kode yayasan dibatasi 8 karakter.
    const stamp = Date.now().toString().slice(-5);
    const admin = await apiToken("admin");
    const yayasan = await apiCall<Dibuat>(admin, "/api/entities", {
      method: "POST",
      body: JSON.stringify({
        code: `UJI${stamp}`,
        legal_name: `Yayasan Penerima ${stamp}`,
        address: "Semarang",
      }),
    });
    expect(yayasan.status).toBe(201);

    const email = `admin.penerima.${stamp}@uji.test`;
    const user = await apiCall<Dibuat>(admin, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: `Admin Penerima ${stamp}`,
        email,
        password: "password123",
        // Melihat master Penerima butuh masters.view. Sejak matriks penguji
        // dipakai, izin itu ada di admin_teratas ke atas — bukan admin_yayasan.
        role: "admin_teratas",
        entity_id: yayasan.body.id,
        scope_type: "entity",
      }),
    });
    expect(user.status).toBe(201);

    try {
      const tokenLain = await apiToken({ email, password: "password123" });
      const daftar = await apiCall<{ data: Array<{ id: number; name: string }> }>(
        tokenLain,
        "/api/penerima?per_page=100",
      );
      expect(daftar.status).toBe(200);
      expect(
        daftar.body.data.some((p) => p.id === vendorId),
        "penerima yayasan lain tidak boleh terlihat",
      ).toBe(false);

      const saran = await apiCall<{ data: Array<{ id: number }> }>(
        tokenLain,
        `/api/penerima/suggest?q=${encodeURIComponent(vendor.slice(0, 8))}`,
      );
      expect(saran.body.data.some((p) => p.id === vendorId)).toBe(false);
    } finally {
      await apiCall(admin, `/api/admin/users/${user.body.id}`, { method: "DELETE" });
      await apiCall(admin, `/api/entities/${yayasan.body.id}`, { method: "DELETE" });
    }
  });
});
