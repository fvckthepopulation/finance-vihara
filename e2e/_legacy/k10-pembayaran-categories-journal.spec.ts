/**
 * K-10: setiap kategori Pembayaran KM menghasilkan JE balanced & ter-posting.
 *
 * Pola: create draft via POST /api/pembayaran → post via POST /api/pembayaran/{id}/post
 * → assert JE.
 *
 * Env:
 *   E2E_API_URL  — Laravel API (default http://localhost:8500)
 */
import { test, expect, request as playwrightRequest, APIRequestContext } from "@playwright/test";
import { USERS } from "../fixtures/auth";

const API = process.env.E2E_API_URL ?? "http://localhost:8500";

// 17 kategori KM (lihat App\Models\Pembayaran::CATEGORIES).
const CATEGORIES = [
  "biaya_payment_gateway",
  "biaya_infrastruktur_cloud",
  "biaya_cdn_bandwidth",
  "gaji_tunjangan",
  "lisensi_saas",
  "bpjs",
  "sewa_kantor",
  "utilitas",
  "perlengkapan_atk",
  "perjalanan_dinas",
  "representasi_jamuan",
  "asuransi",
  "adm_bank",
  "pph_badan",
  "marketing_iklan",
  "biaya_lainnya",
] as const;

const today = () => new Date().toLocaleDateString("en-CA");

test.describe("K-10: Pembayaran semua kategori → JE balanced", () => {
  let api: APIRequestContext;
  let sourceAccountCode: string;
  let entityId: number;

  test.beforeAll(async () => {
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

    // Source bank account
    const banksRes = await api.get("/api/masters/bank-accounts");
    expect(banksRes.ok(), `bank-accounts: ${await banksRes.text()}`).toBeTruthy();
    const banks: Array<{ code: string; entity_id: number | null }> = await banksRes.json();
    const bank = banks.find((b) => b.entity_id != null);
    expect(bank, "butuh minimal 1 rekening bank ter-map ke entity").toBeTruthy();
    sourceAccountCode = bank!.code;
    entityId = bank!.entity_id!;
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  for (const category of CATEGORIES) {
    test(`kategori "${category}" → posted + JE balanced`, async ({}, testInfo) => {
      const payload = {
        date: today(),
        entity_id: entityId,
        source_account_code: sourceAccountCode,
        category,
        amount: 100_000,
        payee_name: `E2E ${category}`,
        description: `K-10 pembayaran ${category}`,
      };

      // 1) draft
      const create = await api.post("/api/pembayaran", { data: payload });
      expect(create.status(), `create ${category}: ${await create.text()}`).toBe(201);
      const draft = await create.json();

      // 2) post (auto JE)
      const post = await api.post(`/api/pembayaran/${draft.id}/post`);
      expect(post.status(), `post ${category}: ${await post.text()}`).toBe(200);
      const posted = await post.json();
      expect(posted.status).toBe("posted");
      expect(posted.linked_journal_entry_id, "JE harus kebuat").toBeTruthy();

      // 3) verify JE
      const jeRes = await api.get(`/api/journal-entries/${posted.linked_journal_entry_id}`);
      expect(jeRes.ok()).toBeTruthy();
      const je = await jeRes.json();
      expect(je.status).toBe("posted");
      expect(je.lines.length).toBeGreaterThanOrEqual(2);
      expect(Number(je.total_debit)).toBeGreaterThan(0);
      expect(Number(je.total_debit)).toBeCloseTo(Number(je.total_credit), 2);
    });
  }
});
