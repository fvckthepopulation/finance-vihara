/**
 * v59 — FV-88 & FV-90: Laporan Penerimaan Dana = buku besar, dan rincian
 * Excel Konsolidasi hanya memuat transaksi terposting.
 *
 * FV-88: dulu Laporan Penerimaan Dana hanya membaca dokumen penerimaan &
 * pengeluaran, sehingga jurnal manual ke akun pendapatan/beban dan pemakaian
 * kas kecil hilang dari totalnya padahal Laporan Keuangan menghitungnya.
 * Mode `laporan=1` di /api/transactions menambahkan keduanya.
 *
 * FV-90: sheet rincian per vihara di Excel Konsolidasi dulu memuat draft yang
 * tidak ikut dihitung.
 */
import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { apiCall, apiToken, login } from "../fixtures/auth";
import { uniq } from "../fixtures/uniq";

test.describe.configure({ mode: "serial" });

type Totals = { masuk: string; keluar: string; count: number };
type Baris = {
  id: number;
  tipe: "Penerimaan" | "Pengeluaran";
  code: string;
  name: string | null;
  amount: string;
  source: string;
  status: string;
  category_label: string;
  created_by?: string | null;
  posted_by?: string | null;
};
type Daftar = { data: Baris[]; totals: Totals };
type Isak35 = {
  period: { start: string; end: string };
  penghasilan: { pendapatan: { total: string }; beban: { total: string } };
};

const TAHUN = new Date().getFullYear();
const NOMINAL = 123_456;
const n = (s: string | number) => Math.round(Number(s));

test.describe("v59 FV-88/FV-90 laporan sama dengan buku besar", () => {
  let admin = "";
  let adminYayasan = "";
  let ydi = 0;
  let vihara = 0;
  let jurnalId = 0;
  let draftId = 0;
  let periode = { start: "", end: "" };
  const tanda = uniq("v59-jm");

  const laporan = (extra = "") =>
    apiCall<Daftar>(
      adminYayasan,
      `/api/transactions?laporan=1&status=posted&entity_id=${ydi}&from=${periode.start}&to=${periode.end}&per_page=200${extra}`,
    );
  const isak = () => apiCall<Isak35>(adminYayasan, `/api/laporan/isak35?mode=ytd&year=${TAHUN}`);

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    adminYayasan = await apiToken("adminYayasan");
    const me = await apiCall<{ entity_id: number }>(adminYayasan, "/api/me");
    ydi = me.body.entity_id;
    const scope = await apiCall<{ viharas: Array<{ id: number; entity_id: number; active?: boolean }> }>(
      adminYayasan,
      "/api/my-scope",
    );
    vihara = scope.body.viharas.find((v) => v.entity_id === ydi)!.id;
    const awal = await isak();
    expect(awal.status).toBe(200);
    periode = { start: awal.body.period.start.slice(0, 10), end: awal.body.period.end.slice(0, 10) };
  });

  test.afterAll(async () => {
    if (jurnalId) {
      await apiCall(admin, `/api/journal-entries/${jurnalId}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "pembersihan uji v59" }),
      });
    }
    if (draftId) await apiCall(admin, `/api/penerimaan/${draftId}`, { method: "DELETE" });
  });

  test("Total laporan = pendapatan & beban Laporan Keuangan (sebelum jurnal uji)", async () => {
    const [lap, lk] = await Promise.all([laporan(), isak()]);
    expect(lap.status).toBe(200);
    expect(n(lap.body.totals.masuk), "Total Penerimaan = Total Pendapatan").toBe(n(lk.body.penghasilan.pendapatan.total));
    expect(n(lap.body.totals.keluar), "Total Pengeluaran = Total Beban").toBe(n(lk.body.penghasilan.beban.total));
  });

  test("Pemakaian kas kecil terposting ikut di Pengeluaran; tanpa mode laporan tidak", async () => {
    const lap = await laporan("&tipe=Pengeluaran");
    const biasa = await apiCall<Daftar>(
      adminYayasan,
      `/api/transactions?status=posted&entity_id=${ydi}&from=${periode.start}&to=${periode.end}&per_page=200&tipe=Pengeluaran`,
    );
    const kk = lap.body.data.filter((b) => b.source === "kas_kecil");
    expect(biasa.body.data.some((b) => b.source === "kas_kecil"), "daftar biasa tanpa kas kecil").toBe(false);
    const selisih = n(lap.body.totals.keluar) - n(biasa.body.totals.keluar);
    expect(selisih, "selisih = jumlah pemakaian kas kecil").toBe(kk.reduce((a, b) => a + n(b.amount), 0));
    for (const b of kk) {
      expect(b.code).toMatch(/^KK-\d+$/);
      expect(b.status).toBe("posted");
    }
  });

  test("Jurnal manual pendapatan terposting tampil sebagai 'Jurnal Manual' dengan pembuat & pemosting", async () => {
    const sebelum = await laporan();
    const lkSebelum = await isak();

    const je = await apiCall<{ id: number }>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify({
        entity_id: ydi,
        vihara_id: vihara,
        entry_date: periode.end,
        description: tanda,
        posting: true,
        lines: [
          { account_code: "1115", debit: NOMINAL, credit: 0 },
          { account_code: "4310", debit: 0, credit: NOMINAL },
        ],
      }),
    });
    expect(je.status, `jurnal manual: ${JSON.stringify(je.body).slice(0, 200)}`).toBe(201);
    jurnalId = je.body.id;

    const [sesudah, lkSesudah] = await Promise.all([laporan(), isak()]);
    expect(n(sesudah.body.totals.masuk) - n(sebelum.body.totals.masuk)).toBe(NOMINAL);
    expect(n(lkSesudah.body.penghasilan.pendapatan.total) - n(lkSebelum.body.penghasilan.pendapatan.total)).toBe(NOMINAL);
    expect(n(sesudah.body.totals.masuk), "tetap sama dengan Laporan Keuangan").toBe(
      n(lkSesudah.body.penghasilan.pendapatan.total),
    );

    const cari = await laporan(`&search=${encodeURIComponent(tanda)}`);
    const baris = cari.body.data.filter((b) => b.source === "jurnal_manual");
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({
      tipe: "Penerimaan",
      code: `JE-${jurnalId}`,
      category_label: "Jurnal Manual",
      status: "posted",
    });
    expect(baris[0].name).toMatch(/^4310 /);
    expect(n(baris[0].amount)).toBe(NOMINAL);
    expect(baris[0].created_by, "nama pembuat").toBeTruthy();
    expect(baris[0].posted_by, "nama pemosting").toBeTruthy();

    // Kategori Dana: jurnal manual tidak punya kategori → tidak ikut.
    const perDana = await laporan(`&category=dana_operasional&search=${encodeURIComponent(tanda)}`);
    expect(perDana.body.data).toHaveLength(0);
    // Filter tipe Pengeluaran tidak memuat jurnal pendapatan.
    const keluar = await laporan(`&tipe=Pengeluaran&search=${encodeURIComponent(tanda)}`);
    expect(keluar.body.data).toHaveLength(0);
    // Daftar biasa (bukan laporan) tetap tanpa jurnal manual.
    const biasa = await apiCall<Daftar>(adminYayasan, `/api/transactions?search=${encodeURIComponent(tanda)}`);
    expect(biasa.body.data).toHaveLength(0);
  });

  test("Jurnal manual yang dibatalkan hilang dari laporan", async () => {
    const sebelum = await laporan();
    const batal = await apiCall(admin, `/api/journal-entries/${jurnalId}/void`, {
      method: "POST",
      body: JSON.stringify({ reason: "uji v59 batal" }),
    });
    expect(batal.status).toBe(200);
    jurnalId = 0;
    const sesudah = await laporan();
    expect(n(sebelum.body.totals.masuk) - n(sesudah.body.totals.masuk)).toBe(NOMINAL);
    expect((await laporan(`&search=${encodeURIComponent(tanda)}`)).body.data).toHaveLength(0);
  });

  test("FV-90: Excel Konsolidasi — rincian per vihara tanpa draft, dengan TOTAL MASUK/KELUAR", async ({ page }) => {
    const dibuat = await apiCall<{ id: number; code: string }>(adminYayasan, "/api/penerimaan", {
      method: "POST",
      body: JSON.stringify({
        date: periode.end,
        method: "tunai",
        vihara_id: vihara,
        description: uniq("v59-draft"),
        draft: true,
      }),
    });
    expect(dibuat.status, "draft penerimaan tersimpan").toBe(201);
    draftId = dibuat.body.id;

    test.setTimeout(240_000);
    // Admin Yayasan YDI hanya punya satu vihara aktif → layar konsolidasinya
    // "khusus level yayasan". Pakai admin (semua yayasan), seperti v60.
    await login(page, "admin");
    await page.goto("/konsolidasi");
    await expect(page.getByText("Total Yayasan", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Export Excel" })).toBeEnabled({ timeout: 60_000 });
    const unduh = page.waitForEvent("download", { timeout: 90_000 });
    await page.getByRole("button", { name: "Export Excel" }).click();
    const berkas = await (await unduh).path();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(berkas!);
    const rincian = wb.worksheets.filter((ws) => /^\d+\. /.test(ws.name) && ws.getRow(1).getCell(1).value === "Tanggal");
    expect(rincian.length, "ada sheet rincian per vihara").toBeGreaterThan(0);

    const kode: string[] = [];
    for (const ws of rincian) {
      let adaTotal = 0;
      ws.eachRow((row, i) => {
        if (i === 1) return;
        const c = String(row.getCell(3).value ?? "");
        if (c) kode.push(c);
        const label = String(row.getCell(5).value ?? "");
        if (label === "TOTAL MASUK" || label === "TOTAL KELUAR") adaTotal += 1;
      });
      expect(adaTotal, `${ws.name}: baris TOTAL MASUK & TOTAL KELUAR`).toBe(2);
    }
    expect(kode, "draft uji tidak tercantum").not.toContain(dibuat.body.code);

    const draft = await apiCall<Daftar>(adminYayasan, `/api/transactions?status=draft&entity_id=${ydi}&per_page=200`);
    for (const d of draft.body.data) expect(kode, `draft ${d.code} tidak tercantum`).not.toContain(d.code);
  });
});
