/**
 * v64 — Transaksi berstatus draft, menunggu persetujuan, dan ditolak tidak
 * boleh masuk laporan mana pun.
 *
 * Spec memotret angka semua laporan, lalu membuat:
 *   - penerimaan draft, penerimaan diajukan, penerimaan ditolak,
 *   - pengeluaran draft, pengeluaran ditolak,
 *   - jurnal manual draft (Dr 1115 / Kr 4310),
 * dan memastikan angka laporan sama persis dengan potretnya.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, viharaIdsByCode } from "../fixtures/auth";
import { rekeningPengeluaran } from "../fixtures/rekening";
import { uniq } from "../fixtures/uniq";

test.describe.configure({ mode: "serial" });

const TAHUN = new Date().getFullYear();
const HARI_INI = () => new Date().toLocaleDateString("en-CA");
const NOMINAL = 654_321;

type Nama = { name: string };

test.describe("v64 draft, diajukan, ditolak tidak masuk laporan", () => {
  let admin = "";
  let pencatat = "";
  let penyetuju = "";
  let vvg = 0;
  let entity = 0;
  let rekening = 0;
  const penerimaan: number[] = [];
  const pembayaran: number[] = [];
  let jurnalDraft = 0;
  const potret: Record<string, string> = {};
  const tanda = uniq("v64");

  /** Angka laporan yang diperiksa — hanya bagian angka, bukan daftar baris. */
  const LAPORAN: Record<string, (t: string) => string> = {
    isak35: () => `/api/laporan/isak35?mode=ytd&year=${TAHUN}`,
    konsolidasi: () => `/api/laporan/konsolidasi?mode=ytd&year=${TAHUN}&entity_id=${entity}`,
    laporan_penerimaan_dana: () =>
      `/api/transactions?laporan=1&status=posted&entity_id=${entity}&from=${TAHUN}-01-01&to=${TAHUN}-12-31&per_page=1`,
    kas_bank: () => `/api/kas-bank?vihara_id=${vvg}`,
    kas_dashboard: () => `/api/cash/dashboard`,
    kas_1115: () => `/api/cash/accounts/1115/transactions?start_date=${TAHUN}-01-01&end_date=${TAHUN}-12-31`,
    neraca_saldo_lama: () => `/api/reports/trial-balance`,
    dana_umat: () => `/api/dana-umat?vihara_id=${vvg}`,
  };

  // Ambil bagian ANGKA saja: totals/ringkasan, buang daftar baris & waktu.
  const angka = (path: string, body: unknown): string => {
    const b = body as Record<string, unknown>;
    if (path.startsWith("/api/transactions")) return JSON.stringify(b.totals);
    if (path.startsWith("/api/cash/accounts")) {
      const { rows: _rows, transactions: _t, data: _d, ...sisa } = b as Record<string, unknown>;
      return JSON.stringify(sisa);
    }
    return JSON.stringify(b);
  };

  async function semuaAngka(): Promise<Record<string, string>> {
    const hasil: Record<string, string> = {};
    for (const [k, f] of Object.entries(LAPORAN)) {
      const p = f(admin);
      const r = await apiCall(admin, p);
      expect(r.status, `${k}: ${JSON.stringify(r.body).slice(0, 150)}`).toBe(200);
      hasil[k] = angka(p, r.body);
    }
    return hasil;
  }

  async function namaPertama(type: "penerimaan" | "pengeluaran", category: string): Promise<string> {
    const r = await apiCall<{ data?: Nama[] } | Nama[]>(
      pencatat,
      `/api/masters/transaction-names?type=${type}&category=${category}&vihara_id=${vvg}`,
    );
    const daftar = Array.isArray(r.body) ? r.body : r.body.data ?? [];
    expect(daftar.length, `ada nama ${type} ${category}`).toBeGreaterThan(0);
    return daftar[0].name;
  }

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    pencatat = await apiToken("bendahara");
    penyetuju = await apiToken("approver");
    vvg = (await viharaIdsByCode()).VVG;
    const v = await apiCall<{ entity_id: number }>(admin, `/api/viharas/${vvg}`);
    entity = (v.body as { entity_id?: number; data?: { entity_id: number } }).entity_id
      ?? (v.body as { data: { entity_id: number } }).data.entity_id;
    rekening = await rekeningPengeluaran(pencatat, vvg);
    Object.assign(potret, await semuaAngka());
  });

  test.afterAll(async () => {
    for (const id of penerimaan) await apiCall(admin, `/api/penerimaan/${id}`, { method: "DELETE" });
    for (const id of pembayaran) await apiCall(admin, `/api/pembayaran/${id}`, { method: "DELETE" });
    if (jurnalDraft) await apiCall(admin, `/api/journal-entries/${jurnalDraft}`, { method: "DELETE" });
  });

  test("Buat penerimaan draft, diajukan, dan ditolak", async () => {
    const nama = await namaPertama("penerimaan", "dana_operasional");
    const isi = (k: string) => ({
      date: HARI_INI(),
      method: "tunai",
      vihara_id: vvg,
      category: "dana_operasional",
      name: nama,
      amount: NOMINAL,
      description: `${tanda} ${k}`,
      draft: true,
    });
    for (const k of ["draft", "diajukan", "ditolak"]) {
      const r = await apiCall<{ id: number; status: string }>(pencatat, "/api/penerimaan", {
        method: "POST",
        body: JSON.stringify(isi(k)),
      });
      expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(201);
      expect(r.body.status).toBe("draft");
      penerimaan.push(r.body.id);
    }
    for (const id of penerimaan.slice(1)) {
      const a = await apiCall<{ status: string }>(pencatat, `/api/penerimaan/${id}/submit`, { method: "POST" });
      expect(a.status, JSON.stringify(a.body).slice(0, 200)).toBe(200);
      expect(a.body.status).toBe("submitted");
    }
    const t = await apiCall<{ status: string }>(penyetuju, `/api/penerimaan/${penerimaan[2]}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: "Uji v64 ditolak" }),
    });
    expect(t.status, JSON.stringify(t.body).slice(0, 200)).toBe(200);
    expect(t.body.status).toBe("rejected");
  });

  test("Buat pengeluaran draft dan ditolak", async () => {
    const nama = await namaPertama("pengeluaran", "biaya_operasional");
    for (const k of ["draft", "ditolak"]) {
      const r = await apiCall<{ id: number }>(pencatat, "/api/pembayaran", {
        method: "POST",
        body: JSON.stringify({
          date: HARI_INI(),
          method: "transfer",
          vihara_id: vvg,
          category: "biaya_operasional",
          name: nama,
          amount: NOMINAL,
          bank_account_id: rekening,
          description: `${tanda} ${k}`,
          draft: true,
        }),
      });
      expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(201);
      pembayaran.push(r.body.id);
    }
    const a = await apiCall<{ status: string }>(pencatat, `/api/pembayaran/${pembayaran[1]}/submit`, { method: "POST" });
    expect(a.status, JSON.stringify(a.body).slice(0, 200)).toBe(200);
    const t = await apiCall<{ status: string }>(penyetuju, `/api/pembayaran/${pembayaran[1]}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: "Uji v64 ditolak" }),
    });
    expect(t.status, JSON.stringify(t.body).slice(0, 200)).toBe(200);
    expect(t.body.status).toBe("rejected");
  });

  test("Buat jurnal manual draft (tanpa posting)", async () => {
    const je = await apiCall<{ id: number; status: string; posted_at: string | null }>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify({
        entity_id: entity,
        vihara_id: vvg,
        entry_date: HARI_INI(),
        description: `${tanda} jurnal draft`,
        lines: [
          { account_code: "1115", debit: NOMINAL, credit: 0 },
          { account_code: "4310", debit: 0, credit: NOMINAL },
        ],
      }),
    });
    expect(je.status, JSON.stringify(je.body).slice(0, 200)).toBe(201);
    expect(je.body.status).toBe("draft");
    expect(je.body.posted_at).toBeNull();
    jurnalDraft = je.body.id;
  });

  test("Angka semua laporan sama persis dengan sebelum transaksi draft/diajukan/ditolak", async () => {
    const sekarang = await semuaAngka();
    for (const k of Object.keys(LAPORAN)) {
      expect(sekarang[k], `laporan ${k} berubah`).toBe(potret[k]);
    }
  });

  test("Laporan Penerimaan Dana tidak memuat satu pun baris uji", async () => {
    const r = await apiCall<{ data: Array<{ id: number }>; totals: { count: number } }>(
      admin,
      `/api/transactions?laporan=1&status=posted&search=${encodeURIComponent(tanda)}&per_page=50`,
    );
    expect(r.body.totals.count).toBe(0);
    // Sementara di daftar transaksi biasa, ketiganya ada sesuai statusnya.
    const semua = await apiCall<{ data: Array<{ status: string }> }>(
      admin,
      `/api/transactions?search=${encodeURIComponent(tanda)}&per_page=50`,
    );
    expect(semua.body.data.map((b) => b.status).sort()).toEqual(
      ["draft", "draft", "rejected", "rejected", "submitted"].sort(),
    );
  });
});
