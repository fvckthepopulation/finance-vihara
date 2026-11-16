/**
 * v58 — FV-62: jurnal pusat yayasan tidak bocor ke yayasan lain; FV-64:
 * jurnal tanpa vihara ditolak, pusat yayasan memakai unit Umum/Pusat.
 *
 * Dulu baris tingkat yayasan disaring hanya dengan "vihara kosong", sehingga
 * jurnal pusat milik yayasan B ikut terbaca di Laporan Keuangan dan
 * Konsolidasi yayasan A. Sejak FV-64 jurnal pusat dicatat di unit
 * "Umum/Pusat Yayasan" (dibuat otomatis per yayasan), dan jurnal tanpa
 * vihara ditolak. Spec ini membuat yayasan uji sementara, memosting jurnal
 * di unit Umum-nya, lalu memastikan angka YDI tidak bergeser sedikit pun dan
 * yayasan uji hanya terbaca oleh yang berhak.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login } from "../fixtures/auth";
import { bersihkanYayasanUji } from "../fixtures/yayasanUji";
import { uniq } from "../fixtures/uniq";

test.describe.configure({ mode: "serial" });

type Entri = {
  vihara: { id: number | null; code: string; name: string } | null;
  pendapatan: { total: string };
  posisi: { total_aset: string };
};
type Konsolidasi = {
  per_yayasan: Array<{ yayasan: { id: number; code: string }; per_vihara: Entri[]; subtotal: Entri | null }>;
  konsolidasi: unknown;
};
type Isak35 = { posisi: unknown; penghasilan: unknown; perubahan: unknown; arus_kas: unknown };
type ScopeVihara = { id: number; code: string; name: string; entity_id: number | null };

const TAHUN = new Date().getFullYear();
const PERIODE = `mode=ytd&year=${TAHUN}`;
const NOMINAL = 1_000_000;

test.describe("v58 FV-62/FV-64 isolasi jurnal pusat yayasan", () => {
  let admin = "";
  let adminYayasan = ""; // YDI, scope entity
  let konsol = ""; // Admin Konsolidasi, scope global
  let ydi = 0;
  let yayasanUji = 0;
  let umumUji: ScopeVihara | null = null;
  let jurnalId = 0;
  const tanda = uniq("v58-pusat");

  // Potret sebelum jurnal yayasan uji diposting.
  let isakYdiAwal = "";
  let konsolYdiAwal = "";

  const angkaIsak = (d: Isak35) => JSON.stringify([d.posisi, d.penghasilan, d.perubahan, d.arus_kas]);
  const angkaKonsol = (d: Konsolidasi) => JSON.stringify(d.per_yayasan.map((y) => [y.yayasan.code, y.per_vihara, y.subtotal]));
  const jurnal = (vihara: number | null) => ({
    entity_id: yayasanUji,
    ...(vihara != null ? { vihara_id: vihara } : {}),
    entry_date: `${TAHUN}-11-10`,
    description: tanda,
    posting: true,
    lines: [
      { account_code: "1120", debit: NOMINAL, credit: 0 },
      { account_code: "4210", debit: 0, credit: NOMINAL },
    ],
  });

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    adminYayasan = await apiToken("adminYayasan");
    konsol = await apiToken("adminKonsolidasi");

    const me = await apiCall<{ entity_id: number }>(adminYayasan, "/api/me");
    ydi = me.body.entity_id;
    expect(ydi, "Admin Yayasan YDI punya yayasan").toBeTruthy();

    const isak = await apiCall<Isak35>(adminYayasan, `/api/laporan/isak35?${PERIODE}`);
    expect(isak.status).toBe(200);
    isakYdiAwal = angkaIsak(isak.body);

    const kon = await apiCall<Konsolidasi>(konsol, `/api/laporan/konsolidasi?${PERIODE}&entity_id=${ydi}`);
    expect(kon.status).toBe(200);
    konsolYdiAwal = angkaKonsol(kon.body);

    const stamp = Date.now().toString().slice(-6);
    const yys = await apiCall<{ id: number }>(admin, "/api/entities", {
      method: "POST",
      body: JSON.stringify({ code: `YB${stamp}`, legal_name: `Yayasan Uji Isolasi ${stamp}`, address: "Bandung" }),
    });
    expect(yys.status, "yayasan uji dibuat").toBe(201);
    yayasanUji = yys.body.id;

    // Unit Umum/Pusat dibuat otomatis bersama yayasannya (P-01).
    const scope = await apiCall<{ viharas: ScopeVihara[] }>(admin, "/api/my-scope");
    umumUji = scope.body.viharas.find((v) => v.entity_id === yayasanUji) ?? null;
    expect(umumUji, "unit Umum/Pusat yayasan uji ada").toBeTruthy();
  });

  test.afterAll(async () => {
    if (jurnalId) {
      await apiCall(admin, `/api/journal-entries/${jurnalId}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "pembersihan uji v58" }),
      });
    }
    if (yayasanUji) await bersihkanYayasanUji(admin, yayasanUji);
  });

  test("FV-64: jurnal tanpa vihara ditolak 422 'Vihara wajib dipilih'", async () => {
    const tolak = await apiCall<{ message: string }>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify(jurnal(null)),
    });
    expect(tolak.status).toBe(422);
    expect(tolak.body.message).toContain("Vihara wajib dipilih");

    const salahYayasan = await apiCall<{ message: string }>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify({ ...jurnal(null), entity_id: ydi, vihara_id: umumUji!.id }),
    });
    expect(salahYayasan.status, "vihara yayasan lain ditolak").toBe(422);
  });

  test("Jurnal pusat yayasan uji diposting di unit Umum-nya", async () => {
    const je = await apiCall<{ id: number; vihara_id: number | null }>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify(jurnal(umumUji!.id)),
    });
    expect(je.status, `jurnal pusat: ${JSON.stringify(je.body).slice(0, 200)}`).toBe(201);
    expect(je.body.vihara_id).toBe(umumUji!.id);
    jurnalId = je.body.id;
  });

  test("Laporan Keuangan Admin Yayasan YDI tidak berubah sedikit pun", async () => {
    const isak = await apiCall<Isak35>(adminYayasan, `/api/laporan/isak35?${PERIODE}`);
    expect(isak.status).toBe(200);
    expect(angkaIsak(isak.body), "posisi, penghasilan, perubahan, arus kas YDI sama").toBe(isakYdiAwal);
  });

  test("Konsolidasi YDI tidak berubah; jurnal pusat hanya terbaca di yayasan pemiliknya, tanpa baris 'Kantor Yayasan'", async () => {
    const ydiKon = await apiCall<Konsolidasi>(konsol, `/api/laporan/konsolidasi?${PERIODE}&entity_id=${ydi}`);
    expect(ydiKon.status).toBe(200);
    expect(angkaKonsol(ydiKon.body), "konsolidasi YDI sama dengan sebelum jurnal uji").toBe(konsolYdiAwal);

    const ujiKon = await apiCall<Konsolidasi>(konsol, `/api/laporan/konsolidasi?${PERIODE}&entity_id=${yayasanUji}`);
    expect(ujiKon.status).toBe(200);
    const baris = ujiKon.body.per_yayasan[0].per_vihara;
    const pusat = baris.find((b) => b.vihara?.id === umumUji!.id);
    expect(pusat, "baris unit Umum ada di yayasan uji").toBeTruthy();
    expect(Number(pusat!.pendapatan.total)).toBe(NOMINAL);
    expect(Number(pusat!.posisi.total_aset)).toBe(NOMINAL);
    expect(baris.some((b) => b.vihara?.code === "YYS"), "tidak ada baris Kantor Yayasan").toBe(false);

    // Semua yayasan: unit Umum yayasan uji hanya di kelompok yayasan uji.
    const semua = await apiCall<Konsolidasi>(konsol, `/api/laporan/konsolidasi?${PERIODE}`);
    expect(semua.status).toBe(200);
    const kelompokYdi = semua.body.per_yayasan.find((y) => y.yayasan.id === ydi)!;
    const kelompokUji = semua.body.per_yayasan.find((y) => y.yayasan.id === yayasanUji)!;
    expect(kelompokUji.per_vihara.some((b) => b.vihara?.id === umumUji!.id && Number(b.pendapatan.total) === NOMINAL)).toBe(true);
    expect(kelompokYdi.per_vihara.some((b) => b.vihara?.id === umumUji!.id)).toBe(false);
    expect(
      JSON.stringify([kelompokYdi.per_vihara, kelompokYdi.subtotal]),
      "kelompok YDI di 'Semua yayasan' = konsolidasi YDI sendiri",
    ).toBe(JSON.stringify([ydiKon.body.per_yayasan[0].per_vihara, ydiKon.body.per_yayasan[0].subtotal]));
  });

  test("Admin Yayasan YDI tidak bisa melihat jurnal maupun angka yayasan lain, termasuk lewat API", async () => {
    const daftar = await apiCall<{ data: Array<{ id: number }> }>(
      adminYayasan,
      `/api/journal-entries?q=${encodeURIComponent(tanda)}&per_page=50`,
    );
    expect(daftar.status).toBe(200);
    expect(daftar.body.data.map((j) => j.id), "jurnal yayasan uji tidak ada di daftar YDI").not.toContain(jurnalId);

    const detail = await apiCall(adminYayasan, `/api/journal-entries/${jurnalId}`);
    expect([403, 404], "detail jurnal yayasan lain ditolak").toContain(detail.status);

    expect((await apiCall(adminYayasan, `/api/laporan/konsolidasi?${PERIODE}&entity_id=${yayasanUji}`)).status).toBe(403);
    expect((await apiCall(adminYayasan, `/api/transactions?entity_id=${yayasanUji}`)).status).toBe(403);
    expect(
      (await apiCall(adminYayasan, `/api/journal-entries/export?q=${encodeURIComponent(tanda)}`)).status,
      "unduhan jurnal tetap bisa, isinya mengikuti cakupan YDI",
    ).toBe(200);
  });

  test("Layar Konsolidasi: unit Umum yayasan uji hanya tampil di yayasan uji", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, "adminKonsolidasi");
    await page.goto("/konsolidasi");
    const pilih = page.getByTestId("konsol-yayasan");
    await expect(pilih).toBeVisible({ timeout: 20_000 });

    await pilih.selectOption(String(yayasanUji));
    // Cari di sel tabel: nama yang sama juga ada sebagai <option> tersembunyi
    // di pemilih vihara header.
    const selUmum = page.locator("td").filter({ hasText: umumUji!.name });
    await expect(selUmum.first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Kantor Yayasan")).toHaveCount(0);

    await pilih.selectOption(String(ydi));
    await expect(page.getByText(/Dhammavihara/).first()).toBeVisible({ timeout: 20_000 });
    await expect(selUmum).toHaveCount(0);
  });
});
