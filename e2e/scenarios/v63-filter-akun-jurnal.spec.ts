/**
 * v63 — Filter akun COA di riwayat Jurnal & Buku Besar.
 *
 * Memilih akun menampilkan jurnal yang punya baris di akun itu (utuh, dengan
 * akun lawannya), plus ringkasan debit/kredit/saldo akun dari jurnal
 * terposting sesuai saringan. Download Excel mengikuti filter yang sama.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login } from "../fixtures/auth";
import { uniq } from "../fixtures/uniq";

test.describe.configure({ mode: "serial" });

type Baris = { id: number; lines: Array<{ account_code: string }> };
type Daftar = {
  data: Baris[];
  total: number;
  ringkasan_akun: { account_code: string; debit: string; kredit: string; saldo: string } | null;
};

const AKUN = "1310"; // Uang Muka Kegiatan — jarang dipakai transaksi lain
const NOMINAL = 77_000;

test.describe("v63 filter akun COA di Jurnal", () => {
  let admin = "";
  let jurnalId = 0;
  const tanda = uniq("v63 filter akun");

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    const yayasan = await apiToken("adminYayasan");
    const ydi = (await apiCall<{ entity_id: number }>(yayasan, "/api/me")).body.entity_id;
    const scope = await apiCall<{ viharas: Array<{ id: number; entity_id: number }> }>(admin, "/api/my-scope");
    const vihara = scope.body.viharas.find((v) => v.entity_id === ydi)!.id;
    const je = await apiCall<{ id: number }>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify({
        entity_id: ydi,
        vihara_id: vihara,
        entry_date: new Date().toLocaleDateString("en-CA"),
        description: tanda,
        posting: true,
        lines: [
          { account_code: AKUN, debit: NOMINAL, credit: 0 },
          { account_code: "1115", debit: 0, credit: NOMINAL },
        ],
      }),
    });
    expect(je.status, JSON.stringify(je.body).slice(0, 200)).toBe(201);
    jurnalId = je.body.id;
  });

  test.afterAll(async () => {
    if (jurnalId) {
      await apiCall(admin, `/api/journal-entries/${jurnalId}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "pembersihan v63" }),
      });
    }
  });

  test("API: hanya jurnal yang memuat akun, utuh; ringkasan akun dari jurnal terposting", async () => {
    const semua = await apiCall<Daftar>(admin, `/api/journal-entries?account_code=${AKUN}&per_page=100`);
    expect(semua.status).toBe(200);
    expect(semua.body.data.length).toBeGreaterThan(0);
    for (const j of semua.body.data) {
      expect(j.lines.map((l) => l.account_code), `JE ${j.id} memuat ${AKUN}`).toContain(AKUN);
    }

    const satu = await apiCall<Daftar>(
      admin,
      `/api/journal-entries?account_code=${AKUN}&q=${encodeURIComponent(tanda)}`,
    );
    expect(satu.body.total).toBe(1);
    expect(satu.body.data[0].lines.map((l) => l.account_code).sort()).toEqual(["1115", AKUN].sort());
    expect(satu.body.ringkasan_akun).toMatchObject({ account_code: AKUN });
    expect(Number(satu.body.ringkasan_akun!.debit)).toBe(NOMINAL);
    expect(Number(satu.body.ringkasan_akun!.saldo)).toBe(NOMINAL);

    const tanpa = await apiCall<Daftar>(admin, `/api/journal-entries?q=${encodeURIComponent(tanda)}`);
    expect(tanpa.body.ringkasan_akun, "tanpa filter akun tidak ada ringkasan").toBeNull();
    const lain = await apiCall<Daftar>(admin, `/api/journal-entries?account_code=6100&q=${encodeURIComponent(tanda)}`);
    expect(lain.body.total, "akun lain tidak memuat jurnal uji").toBe(0);
  });

  test("Download Excel mengikuti filter akun", async () => {
    const r = await fetch(
      `${process.env.E2E_API_URL ?? "http://localhost:8500"}/api/journal-entries/export?account_code=${AKUN}&q=${encodeURIComponent(tanda)}`,
      { headers: { Authorization: `Bearer ${admin}` } },
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition") ?? "").toContain(`akun${AKUN}`);
  });

  test("Layar: pilih akun → daftar tersaring dan ringkasan akun tampil", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, "admin");
    await page.goto("/jurnal");
    const filter = page.getByTestId("filter-akun");
    await expect(filter.locator(`option[value="${AKUN}"]`)).toHaveCount(1, { timeout: 30_000 });
    await filter.selectOption(AKUN);
    await page.getByTestId("cari-jurnal").fill(tanda);

    await expect(page.getByTestId(`detail-je-${jurnalId}`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("1 entry")).toBeVisible();
    const ringkasan = page.getByTestId("ringkasan-akun");
    await expect(ringkasan).toContainText(AKUN);
    await expect(ringkasan).toContainText(`Debit Rp ${NOMINAL.toLocaleString("id-ID")}`);

    await filter.selectOption("");
    await expect(ringkasan).toHaveCount(0);
  });
});
