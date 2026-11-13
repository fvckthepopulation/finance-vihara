/**
 * v39 — Alur draft → persetujuan.
 *
 * Model izin memisahkan "boleh mencatat" (*.create) dari "boleh menyetujui"
 * (*.approve), tapi form selalu memposting begitu disimpan. Akibatnya role
 * yang hanya punya .create mustahil dipakai: pembuatannya berhasil,
 * postingnya 403 "This action is unauthorized.", dan yang tertinggal adalah
 * draft yang tidak muncul di layar mana pun — jadi tiap klik yang gagal
 * diam-diam menambah satu baris gantung.
 *
 * Yang diuji: pencatat berhenti di draft tanpa error, penyetuju melihat dan
 * memposting draft itu, dan draft vihara lain tetap tidak bisa disentuh.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";

type Dibuat = { id: number; code?: string; status?: string };

const stamp = Date.now().toString().slice(-6);
const ROLE_PENCATAT = `e2e_catat_${stamp}`;
const ROLE_PENYETUJU = `e2e_setuju_${stamp}`;
const EMAIL_PENCATAT = `${ROLE_PENCATAT}@uji.test`;
const EMAIL_PENYETUJU = `${ROLE_PENYETUJU}@uji.test`;
const PASSWORD = "password123";
// Penanda unik per-run. Tanpa ini, draft bernominal sama dari run sebelumnya
// ikut tersaring dan asersi "sudah tidak ada" gagal di suite penuh.
const BUKTI = `E2E-SETUJU-${stamp}`;

let adminToken = "";
let viharaVvg = 0;
let yayasanId = 0;
const dibersihkan: Array<{ path: string }> = [];

test.describe.configure({ mode: "serial" });

test.describe("v39 persetujuan", () => {
  test.beforeAll(async () => {
    adminToken = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
    const vvg = await apiCall<{ entity_id: number }>(adminToken, `/api/viharas/${viharaVvg}`);
    yayasanId = vvg.body.entity_id;

    for (const [role, izin] of [
      [ROLE_PENCATAT, ["pembayaran.view", "pembayaran.create", "cash.view"]],
      [ROLE_PENYETUJU, ["pembayaran.view", "pembayaran.approve", "cash.view"]],
    ] as const) {
      const r = await apiCall<Dibuat>(adminToken, "/api/admin/roles", {
        method: "POST",
        body: JSON.stringify({ name: role, permissions: izin }),
      });
      expect(r.status).toBe(201);
      dibersihkan.push({ path: `/api/admin/roles/${r.body.id}` });
    }
    for (const [nama, email, role] of [
      ["Pencatat Uji", EMAIL_PENCATAT, ROLE_PENCATAT],
      ["Penyetuju Uji", EMAIL_PENYETUJU, ROLE_PENYETUJU],
    ] as const) {
      const u = await apiCall<Dibuat>(adminToken, "/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: nama,
          email,
          password: PASSWORD,
          role,
          entity_id: yayasanId,
          scope_type: "vihara",
          vihara_ids: [viharaVvg],
        }),
      });
      expect(u.status).toBe(201);
      dibersihkan.unshift({ path: `/api/admin/users/${u.body.id}` });
    }
  });

  test.afterAll(async () => {
    // Pengguna dulu, baru rolenya — API menolak menghapus role yang dipakai.
    for (const x of dibersihkan) {
      await apiCall(adminToken, x.path, { method: "DELETE" });
    }
  });

  test("pencatat: tersimpan sebagai draft, tanpa pesan unauthorized", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL_PENCATAT);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL("**/dashboard");

    await page.goto("/pembayaran");

    // Pencatat punya Simpan sebagai Draft DAN Ajukan Persetujuan; yang
    // mengantre hanya yang diajukan — draft tetap miliknya sendiri.
    await expect(page.getByTestId("tombol-draft")).toBeVisible({ timeout: 10_000 });
    const simpan = page.getByTestId("tombol-ajukan");
    await expect(simpan).toBeVisible();

    await page.getByLabel("Jumlah (Rp) *").fill("55000");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await selectByLabelRegex(page.getByLabel("Nama Pengeluaran *"), /Biaya ATK/);
    await selectByLabelRegex(page.getByTestId("form-rekening"), /BCA/);
    await page.getByLabel("No. Bukti / Referensi").fill(BUKTI);
    await simpan.click();

    await expect(page.getByText(/diajukan — menunggu persetujuan/)).toBeVisible({ timeout: 10_000 });
    // Inti laporannya: pesan ini tidak boleh muncul lagi.
    await expect(page.locator("body")).not.toContainText("This action is unauthorized");

    // Menu Persetujuan bukan untuknya.
    await expect(page.locator('a[href="/persetujuan"]')).toHaveCount(0);
  });

  test("penyetuju: melihat draft itu lalu mempostingnya", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL_PENYETUJU);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL("**/dashboard");

    // Sidebar dirender dua kali (desktop + laci mobile), jadi ambil yang pertama.
    await expect(page.locator('a[href="/persetujuan"]').first()).toBeVisible();
    await page.goto("/persetujuan");

    const baris = page.locator("tbody tr").filter({ hasText: BUKTI }).first();
    await expect(baris).toBeVisible({ timeout: 10_000 });

    const setujui = baris.locator('[data-testid^="setujui-"]');
    await expect(setujui).toBeVisible();
    await setujui.click();

    // Hilang dari daftar tunggu karena sudah diposting.
    await expect(
      page.locator("tbody tr").filter({ hasText: BUKTI }),
    ).toHaveCount(0, { timeout: 10_000 });

    // Dan benar-benar posted di server.
    const daftar = await apiCall<{ data: Array<{ reference: string | null; status: string }> }>(
      adminToken,
      `/api/transactions?vihara_id=${viharaVvg}&per_page=100&tipe=Pengeluaran`,
    );
    const baru = daftar.body.data.find((r) => r.reference === BUKTI);
    expect(baru?.status).toBe("posted");
  });

  test("penyetuju boleh menolak draft walau tidak punya izin mencatat", async () => {
    const tokenPencatat = await apiToken({ email: EMAIL_PENCATAT, password: PASSWORD });
    const rek = await apiCall<{ data?: Array<{ id: number }> } | Array<{ id: number }>>(
      tokenPencatat,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}`,
    );
    const daftarRek = Array.isArray(rek.body) ? rek.body : (rek.body.data ?? []);

    const draft = await apiCall<Dibuat>(tokenPencatat, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: new Date().toLocaleDateString("en-CA"),
        method: "transfer",
        category: "biaya_operasional",
        name: "Biaya ATK",
        amount: 64000,
        bank_account_id: daftarRek[0].id,
      }),
    });
    expect(draft.status).toBe(201);

    const tokenPenyetuju = await apiToken({ email: EMAIL_PENYETUJU, password: PASSWORD });
    const ditolak = await apiCall(tokenPenyetuju, `/api/pembayaran/${draft.body.id}`, {
      method: "DELETE",
    });
    expect(ditolak.status).toBe(200);
  });

  test("draft vihara lain tetap tidak bisa dihapus", async () => {
    // Celah yang ditemukan saat mengerjakan ini: destroy tidak pernah
    // memeriksa vihara, jadi siapa pun yang boleh mencatat di viharanya
    // sendiri bisa menghapus draft vihara lain hanya dengan menebak id.
    const tokenVvg = await apiToken("bendahara");
    const rek = await apiCall<{ data?: Array<{ id: number }> } | Array<{ id: number }>>(
      tokenVvg,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}`,
    );
    const daftarRek = Array.isArray(rek.body) ? rek.body : (rek.body.data ?? []);

    const draft = await apiCall<Dibuat>(tokenVvg, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: new Date().toLocaleDateString("en-CA"),
        method: "transfer",
        category: "biaya_operasional",
        name: "Biaya ATK",
        amount: 71000,
        bank_account_id: daftarRek[0].id,
      }),
    });
    expect(draft.status).toBe(201);

    const tokenVbm = await apiToken("bendaharaVbm");
    const dicuri = await apiCall(tokenVbm, `/api/pembayaran/${draft.body.id}`, {
      method: "DELETE",
    });
    expect(dicuri.status).toBe(403);

    // Pemiliknya sendiri tetap bisa.
    expect(
      (await apiCall(tokenVvg, `/api/pembayaran/${draft.body.id}`, { method: "DELETE" })).status,
    ).toBe(200);
  });
});
