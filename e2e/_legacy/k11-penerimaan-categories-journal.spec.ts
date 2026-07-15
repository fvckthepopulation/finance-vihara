/**
 * K-11: setiap kategori Penerimaan KM menghasilkan JE balanced & ter-posting.
 *
 * Env: E2E_API_URL (default http://localhost:8500)
 */
import { test, expect, request as playwrightRequest, APIRequestContext } from "@playwright/test";
import { USERS } from "../fixtures/auth";

const API = process.env.E2E_API_URL ?? "http://localhost:8500";

const CATEGORIES = [
  "bunga_bank",
  "komisi_settlement",
  "pendapatan_lain",
  "pengembalian_dana",
] as const;

const today = () => new Date().toLocaleDateString("en-CA");

test.describe("K-11: Penerimaan semua kategori → JE balanced", () => {
  let api: APIRequestContext;
  let targetAccountCode: string;
  let entityId: number;

  test.beforeAll(async () => {
    const anon = await playwrightRequest.newContext({ baseURL: API });
    const loginRes = await anon.post("/api/login", {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { token } = await loginRes.json();
    await anon.dispose();

    api = await playwrightRequest.newContext({
      baseURL: API,
      extraHTTPHeaders: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    const banksRes = await api.get("/api/masters/bank-accounts");
    const banks: Array<{ code: string; entity_id: number | null }> = await banksRes.json();
    const bank = banks.find((b) => b.entity_id != null);
    expect(bank).toBeTruthy();
    targetAccountCode = bank!.code;
    entityId = bank!.entity_id!;
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  for (const category of CATEGORIES) {
    test(`kategori "${category}" → posted + JE balanced`, async () => {
      const create = await api.post("/api/penerimaan", {
        data: {
          date: today(),
          entity_id: entityId,
          target_account_code: targetAccountCode,
          category,
          amount: 50_000,
          payer_name: `E2E ${category}`,
          description: `K-11 penerimaan ${category}`,
        },
      });
      expect(create.status(), `create ${category}: ${await create.text()}`).toBe(201);
      const draft = await create.json();

      const post = await api.post(`/api/penerimaan/${draft.id}/post`);
      expect(post.status(), `post ${category}: ${await post.text()}`).toBe(200);
      const posted = await post.json();
      expect(posted.status).toBe("posted");
      expect(posted.linked_journal_entry_id).toBeTruthy();

      const jeRes = await api.get(`/api/journal-entries/${posted.linked_journal_entry_id}`);
      const je = await jeRes.json();
      expect(je.status).toBe("posted");
      expect(je.lines.length).toBeGreaterThanOrEqual(2);
      expect(Number(je.total_debit)).toBeGreaterThan(0);
      expect(Number(je.total_debit)).toBeCloseTo(Number(je.total_credit), 2);
    });
  }
});
