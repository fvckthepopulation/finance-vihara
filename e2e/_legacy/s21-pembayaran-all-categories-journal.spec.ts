/**
 * S-21: Setiap kategori Pembayaran harus menghasilkan jurnal (GL) yang
 * berimbang & ter-posting.
 *
 * API-driven (bukan UI) supaya bisa menyapu SEMUA kategori dengan cepat dan
 * stabil. Untuk tiap kategori kita panggil POST /api/pembayaran/post-now
 * (bypass 4-stage approval — admin/superadmin punya semua perm), lalu pastikan:
 *   - pembayaran berstatus "transferred"
 *   - linked_journal_entry_id terisi (jurnal kebuat)
 *   - JE-nya status "posted", reference_type "pembayaran", debit == credit, >= 2 baris
 *
 * Catatan: pakai method "transfer". Method "giro" butuh akun 409-00 (Giro
 * Beredar) yang belum ada di seeder, jadi sengaja tidak diuji di sini.
 *
 * Env:
 *   E2E_API_URL  — base URL Laravel API (default http://localhost:8500)
 */
import { test, expect, request as playwrightRequest, APIRequestContext } from "@playwright/test";
import { USERS } from "../fixtures/auth";

const API = process.env.E2E_API_URL ?? "http://localhost:8500";

// Semua kategori yang diterima backend (lihat CHECK constraint pembayaran.category
// + validasi PembayaranController). Untuk setiap kategori, posting service punya
// fallback debit account, KECUALI penyusutan & lainnya yang wajib kirim eksplisit.
const CATEGORIES = [
  "hutang", "uangmuka", "gaji", "listrik", "sewa", "transport", "konsinyasi",
  "ppn", "pph21", "pph23", "pph42", "pph25", "pph_final",
  "marketing", "pemeliharaan", "pemeliharaan-mesin", "pemeliharaan-outlet", "pemeliharaan-kantor",
  "atk", "software", "entertainment", "penyusutan",
  "iuran", "deposit", "asuransi", "jasa_profesional", "pbjt", "pph_badan",
  "aktiva_tetap", "cicilan_bank_pendek", "cicilan_bank_panjang", "bunga_bank",
  "lainnya",
] as const;

// Kategori tanpa fallback debit account di posting service → kirim eksplisit.
const EXPLICIT_DEBIT: Record<string, string> = {
  penyusutan: "766-00", // Biaya Umum Lainnya (cukup untuk smoke-test jurnal)
  lainnya: "766-00",
};

const today = () => new Date().toLocaleDateString("en-CA");

test.describe("S-21: Pembayaran semua kategori → jurnal kebuat", () => {
  let api: APIRequestContext;
  let sourceAccountCode: string;
  let entityId: number;

  test.beforeAll(async () => {
    // Login (admin = superadmin, punya semua perm pembayaran).
    const anon = await playwrightRequest.newContext({ baseURL: API });
    const loginRes = await anon.post("/api/login", {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    expect(loginRes.ok(), `login gagal: ${await loginRes.text()}`).toBeTruthy();
    const { token } = await loginRes.json();
    await anon.dispose();

    api = await playwrightRequest.newContext({
      baseURL: API,
      extraHTTPHeaders: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    // Rekening sumber dana — harus yang sudah dipetakan ke entity (entity_id-nya
    // menentukan entitas pembayar + entity_id di JE).
    const banksRes = await api.get("/api/masters/bank-accounts");
    expect(banksRes.ok(), `gagal ambil bank-accounts: ${await banksRes.text()}`).toBeTruthy();
    const banks: Array<{ code: string; entity_id: number | null }> = await banksRes.json();
    const bank = banks.find((b) => b.entity_id != null);
    expect(bank, "butuh minimal 1 rekening bank yang ter-map ke entity").toBeTruthy();
    sourceAccountCode = bank!.code;
    entityId = bank!.entity_id!;
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  for (const category of CATEGORIES) {
    test(`kategori "${category}" → JE berimbang & posted`, async () => {
      const payload: Record<string, unknown> = {
        date: today(),
        method: "transfer",
        source_account_code: sourceAccountCode,
        category,
        entity_id: entityId,
        amount: 100_000,
        payee_name: `E2E ${category}`,
        description: `E2E pembayaran ${category}`,
      };
      if (EXPLICIT_DEBIT[category]) payload.debit_account_code = EXPLICIT_DEBIT[category];

      const res = await api.post("/api/pembayaran/post-now", { data: payload });
      expect(res.status(), `post-now ${category} gagal: ${await res.text()}`).toBe(201);

      const pembayaran = await res.json();
      expect(pembayaran.status, `status pembayaran ${category}`).toBe("transferred");
      expect(
        pembayaran.linked_journal_entry_id,
        `jurnal HARUS kebuat untuk kategori ${category}`,
      ).toBeTruthy();

      // Verifikasi isi jurnalnya.
      const jeRes = await api.get(`/api/journal-entries/${pembayaran.linked_journal_entry_id}`);
      expect(jeRes.ok(), `gagal ambil JE ${category}: ${await jeRes.text()}`).toBeTruthy();
      const je = await jeRes.json();

      expect(je.status, `JE ${category} harus posted`).toBe("posted");
      expect(je.reference_type, `reference_type JE ${category}`).toBe("pembayaran");
      expect(Number(je.entity_id), `entity JE ${category}`).toBe(entityId);
      expect(Array.isArray(je.lines) && je.lines.length, `JE ${category} minimal 2 baris`).toBeGreaterThanOrEqual(2);
      expect(Number(je.total_debit), `total debit ${category} > 0`).toBeGreaterThan(0);
      expect(Number(je.total_debit), `JE ${category} harus balance`).toBeCloseTo(Number(je.total_credit), 2);
    });
  }
});
