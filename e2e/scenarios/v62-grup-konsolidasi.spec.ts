/**
 * v62 — FV-66: Grup Konsolidasi dengan eliminasi transaksi antar yayasan.
 *
 * Grup = lapisan laporan di atas pembukuan tiap yayasan yang tetap terpisah.
 * Transaksi antar anggota (5400 penyaluran ↔ 4410/4420 penerimaan dari
 * yayasan afiliasi) dieliminasi di laporan grup supaya pendapatan & beban
 * grup tidak terhitung ganda. Spec membuat yayasan uji sementara, menggabungnya
 * dengan YDI dalam satu grup, lalu memeriksa angka, peringatan, aturan
 * keanggotaan, dan layarnya.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login } from "../fixtures/auth";
import { bersihkanYayasanUji } from "../fixtures/yayasanUji";
import { uniq } from "../fixtures/uniq";

test.describe.configure({ mode: "serial" });

type Money = string | number;
type Entry = {
  pendapatan: { tp: Money; dp: Money; total: Money };
  beban: { total: Money };
  kenaikan: { total: Money };
  posisi: { total_aset: Money; aset_neto: { total: Money } };
};
type Laporan = {
  grup: { id: number; nama: string };
  anggota: Array<{ yayasan: { id: number; code: string }; periode: { start: string; end: string }; entry: Entry }>;
  eliminasi: Entry;
  total: Entry;
  peringatan: Array<{ jenis: string; pesan: string; selisih: Money; transaksi: Array<{ code: string; akun: string }> }>;
};
type ScopeVihara = { id: number; entity_id: number | null; code: string };

const TAHUN = new Date().getFullYear();
const NOMINAL = 1_000_000;
const n = (v: Money) => Math.round(Number(v));

test.describe("v62 FV-66 grup konsolidasi", () => {
  let admin = "";
  let ydi = 0;
  let viharaYdi = 0;
  let uji = 0;
  let umumUji = 0;
  let grupId = 0;
  let grupNama = "";
  const jurnal: number[] = [];
  let awal: Laporan;

  const laporan = async () => {
    const r = await apiCall<Laporan>(admin, `/api/laporan/konsolidasi-grup?group_id=${grupId}&mode=ytd&year=${TAHUN}`);
    expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(200);
    return r.body;
  };
  const posting = async (entity: number, vihara: number, lines: Array<{ account_code: string; debit: number; credit: number }>) => {
    const r = await apiCall<{ id: number }>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify({
        entity_id: entity,
        vihara_id: vihara,
        entry_date: `${TAHUN}-11-10`,
        description: uniq("v62 antar yayasan"),
        posting: true,
        lines,
      }),
    });
    expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(201);
    jurnal.push(r.body.id);
    return r.body.id;
  };
  const anggota = (l: Laporan, id: number) => l.anggota.find((a) => a.yayasan.id === id)!;

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    const yayasanUser = await apiToken("adminYayasan");
    ydi = (await apiCall<{ entity_id: number }>(yayasanUser, "/api/me")).body.entity_id;

    const stamp = Date.now().toString().slice(-6);
    const yys = await apiCall<{ id: number }>(admin, "/api/entities", {
      method: "POST",
      body: JSON.stringify({ code: `YG${stamp}`, legal_name: `Yayasan Uji Grup ${stamp}`, address: "Bogor" }),
    });
    expect(yys.status).toBe(201);
    uji = yys.body.id;

    const scope = await apiCall<{ viharas: ScopeVihara[] }>(admin, "/api/my-scope");
    viharaYdi = scope.body.viharas.find((v) => v.entity_id === ydi)!.id;
    umumUji = scope.body.viharas.find((v) => v.entity_id === uji)!.id;

    grupNama = uniq("Grup v62");
    const g = await apiCall<{ id: number }>(admin, "/api/konsolidasi-groups", {
      method: "POST",
      body: JSON.stringify({
        name: grupNama,
        members: [
          { entity_id: ydi, start_date: `${TAHUN}-01-01` },
          { entity_id: uji, start_date: `${TAHUN}-01-01` },
        ],
      }),
    });
    expect(g.status, JSON.stringify(g.body).slice(0, 200)).toBe(201);
    grupId = g.body.id;
    awal = await laporan();
  });

  test.afterAll(async () => {
    for (const id of jurnal) {
      await apiCall(admin, `/api/journal-entries/${id}/void`, { method: "POST", body: JSON.stringify({ reason: "pembersihan v62" }) });
    }
    if (grupId) await apiCall(admin, `/api/konsolidasi-groups/${grupId}`, { method: "DELETE" });
    if (uji) await bersihkanYayasanUji(admin, uji);
  });

  test("Akun antar yayasan tersedia di COA", async () => {
    const coa = await apiCall<{ data?: Array<{ code: string }> } | Array<{ code: string }>>(admin, "/api/coa?per_page=300");
    const daftar = Array.isArray(coa.body) ? coa.body : coa.body.data ?? [];
    const kode = daftar.map((a) => a.code);
    for (const k of ["4400", "4410", "4420", "5400", "1320", "2320"]) expect(kode, `akun ${k}`).toContain(k);
  });

  test("Kolom yayasan = Laporan Keuangan yayasan itu (Konsolidasi per yayasan)", async () => {
    const kon = await apiCall<{ per_yayasan: Array<{ subtotal: Entry | null }> }>(
      admin,
      `/api/laporan/konsolidasi?mode=ytd&year=${TAHUN}&entity_id=${ydi}`,
    );
    const sub = kon.body.per_yayasan[0].subtotal!;
    const kolom = anggota(awal, ydi).entry;
    expect(n(kolom.pendapatan.total)).toBe(n(sub.pendapatan.total));
    expect(n(kolom.beban.total)).toBe(n(sub.beban.total));
    expect(n(kolom.posisi.total_aset)).toBe(n(sub.posisi.total_aset));
  });

  test("Penyaluran YDI → yayasan uji dieliminasi: total grup tidak bertambah", async () => {
    await posting(ydi, viharaYdi, [
      { account_code: "5400", debit: NOMINAL, credit: 0 },
      { account_code: "1120", debit: 0, credit: NOMINAL },
    ]);
    await posting(uji, umumUji, [
      { account_code: "1130", debit: NOMINAL, credit: 0 },
      { account_code: "4410", debit: 0, credit: NOMINAL },
    ]);
    const l = await laporan();

    // Per yayasan TIDAK dieliminasi.
    expect(n(anggota(l, ydi).entry.beban.total) - n(anggota(awal, ydi).entry.beban.total)).toBe(NOMINAL);
    expect(n(anggota(l, uji).entry.pendapatan.total) - n(anggota(awal, uji).entry.pendapatan.total)).toBe(NOMINAL);
    // Kolom eliminasi.
    expect(n(l.eliminasi.pendapatan.total)).toBe(-NOMINAL);
    expect(n(l.eliminasi.beban.total)).toBe(-NOMINAL);
    // Total grup: pendapatan & beban tidak bertambah, aset neto tetap.
    expect(n(l.total.pendapatan.total)).toBe(n(awal.total.pendapatan.total));
    expect(n(l.total.beban.total)).toBe(n(awal.total.beban.total));
    expect(n(l.total.posisi.aset_neto.total)).toBe(n(awal.total.posisi.aset_neto.total));
    // Total = Σ yayasan + eliminasi.
    const jumlah = l.anggota.reduce((s, a) => s + n(a.entry.pendapatan.total), 0) + n(l.eliminasi.pendapatan.total);
    expect(n(l.total.pendapatan.total)).toBe(jumlah);
    expect(l.peringatan).toHaveLength(0);
  });

  test("Belum seimbang: peringatan berisi selisih & daftar jurnal; hanya bagian cocok yang dieliminasi", async () => {
    await posting(ydi, viharaYdi, [
      { account_code: "5400", debit: 250_000, credit: 0 },
      { account_code: "1120", debit: 0, credit: 250_000 },
    ]);
    const l = await laporan();
    expect(l.peringatan).toHaveLength(1);
    expect(l.peringatan[0].pesan).toContain("Transaksi antar yayasan belum seimbang");
    expect(n(l.peringatan[0].selisih)).toBe(250_000);
    expect(l.peringatan[0].transaksi.map((t) => t.akun)).toEqual(expect.arrayContaining(["5400", "4410"]));
    expect(n(l.eliminasi.beban.total)).toBe(-NOMINAL);
  });

  test("Satu yayasan tidak boleh di dua grup pada periode yang sama", async () => {
    const r = await apiCall<{ message: string }>(admin, "/api/konsolidasi-groups", {
      method: "POST",
      body: JSON.stringify({ name: uniq("Grup bentrok"), members: [{ entity_id: uji, start_date: `${TAHUN}-06-01` }] }),
    });
    expect(r.status).toBe(422);
    expect(r.body.message).toContain(grupNama);
    expect(r.body.message).toContain("Satu yayasan hanya boleh di satu grup");
  });

  test("Periode keanggotaan: yayasan yang keluar sebelum transaksi tidak ikut sesudahnya", async () => {
    const ubah = await apiCall(admin, `/api/konsolidasi-groups/${grupId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: grupNama,
        members: [
          { entity_id: ydi, start_date: `${TAHUN}-01-01` },
          { entity_id: uji, start_date: `${TAHUN}-01-01`, end_date: `${TAHUN}-06-30` },
        ],
      }),
    });
    expect(ubah.status).toBe(200);
    const l = await laporan();
    expect(anggota(l, uji).periode.end).toBe(`${TAHUN}-06-30`);
    expect(n(anggota(l, uji).entry.pendapatan.total), "penerimaan Nov tidak ikut").toBe(0);

    // Kembalikan keanggotaan penuh untuk test layar.
    await apiCall(admin, `/api/konsolidasi-groups/${grupId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: grupNama,
        members: [
          { entity_id: ydi, start_date: `${TAHUN}-01-01` },
          { entity_id: uji, start_date: `${TAHUN}-01-01` },
        ],
      }),
    });
  });

  test("Layar Konsolidasi: pilih grup → kolom per yayasan, Eliminasi, Total Grup; kolom yayasan bisa disembunyikan", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, "admin");
    await page.goto("/konsolidasi");
    const pilih = page.getByTestId("konsol-yayasan");
    await expect(pilih.locator(`option[value="g:${grupId}"]`)).toHaveCount(1, { timeout: 30_000 });
    await pilih.selectOption(`g:${grupId}`);

    await expect(page.getByTestId("grup-tabel")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("grup-kolom-yayasan")).toHaveCount(2);
    await expect(page.getByRole("columnheader", { name: "Eliminasi" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Total Grup" })).toBeVisible();
    await expect(page.getByTestId("grup-peringatan")).toContainText("belum seimbang");
    const elim = page.getByTestId("grup-baris-Total Beban").getByTestId("grup-eliminasi");
    await expect(elim).toHaveText(`(${NOMINAL.toLocaleString("id-ID")})`);

    await page.getByTestId("grup-toggle-kolom").uncheck();
    await expect(page.getByTestId("grup-kolom-yayasan")).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Total Grup" })).toBeVisible();
  });

  test("Master Grup Konsolidasi menampilkan grup beserta anggotanya", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, "admin");
    await page.goto("/admin/grup-konsolidasi");
    const kartu = page.getByTestId("grup-kartu").filter({ hasText: grupNama });
    await expect(kartu).toBeVisible({ timeout: 30_000 });
    await expect(kartu).toContainText("Yayasan Uji Grup");
  });
});
