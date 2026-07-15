/**
 * v40 — Rekonsiliasi (/rekonsiliasi + /rekonsiliasi/[id]).
 * Yang diuji (vihara VVG):
 *  1. Halaman utama: 3 kartu ringkasan (Bank / 1160 PG Clearing / 2310 Suspense)
 *     + 3 tab; tab PG default menampilkan "Saldo Akun 1160".
 *  2. Alur suspense: seed penerimaan donasi_belum_teridentifikasi via API →
 *     tampil di tab suspense → Identifikasi → reklasifikasi → toast + baris hilang.
 *  3. Alur run bank: seed penerimaan transfer via API → buka run → tambah item
 *     koran dengan jumlah sama → auto-match → Terapkan Semua Match; item koran
 *     manual tak-cocok bisa dihapus (✕).
 * Idempotent: jumlah/desk unik per run. Run yang sudah COMPLETED mengunci slot
 * bank+bulan (422 → run_id), jadi test memilih bank yang run bulan berjalannya
 * belum completed; bila semua terkunci, fallback buat run bulan lampau via API.
 */
import { test, expect, Page } from "@playwright/test";
import { login, pickViharaVVG } from "../fixtures/auth";
import { uniq, today } from "../fixtures/uniq";

const API = process.env.E2E_API_URL ?? "http://localhost:8500";

const fmtRp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

/** Jumlah unik per run supaya baris mudah ditemukan & gak bentrok antar run. */
function uniqAmount(base: number): number {
  return base + (Date.now() % 900_000);
}

async function getToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => window.localStorage.getItem("vf_token"));
  if (!token) throw new Error("vf_token tidak ditemukan di localStorage — login dulu");
  return token;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

type BankAccount = { id: number; vihara_id: number; account_number: string; bank_name: string };

/** Semua rekening milik VVG (ditemukan via norek BCA seed 6280-3488-88). */
async function getVvgBanks(page: Page, token: string): Promise<BankAccount[]> {
  const res = await page.request.get(`${API}/api/masters/vihara-bank-accounts`, {
    headers: authHeaders(token),
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: BankAccount[] };
  const bca = body.data.find((b) => b.account_number === "6280-3488-88");
  if (!bca) throw new Error("Rekening BCA VVG (6280-3488-88) tidak ditemukan");
  return body.data.filter((b) => b.vihara_id === bca.vihara_id);
}

/** Buat + post penerimaan transfer via API (seed data test). */
async function seedPenerimaan(
  page: Page,
  token: string,
  opts: {
    bankAccountId: number;
    viharaId: number;
    date: string;
    category: string;
    amount: number;
    description: string;
    sourceName: string;
  },
): Promise<void> {
  const createRes = await page.request.post(`${API}/api/penerimaan`, {
    headers: authHeaders(token),
    data: {
      date: opts.date,
      method: "transfer",
      bank_account_id: opts.bankAccountId,
      category: opts.category,
      amount: opts.amount,
      source_name: opts.sourceName,
      description: opts.description,
      vihara_id: opts.viharaId,
    },
  });
  expect(createRes.ok(), `create penerimaan: ${createRes.status()} ${await createRes.text()}`).toBeTruthy();
  const created = (await createRes.json()) as { id: number };
  const postRes = await page.request.post(`${API}/api/penerimaan/${created.id}/post`, {
    headers: authHeaders(token),
  });
  expect(postRes.ok(), `post penerimaan: ${postRes.status()} ${await postRes.text()}`).toBeTruthy();
}

type RunSummary = { id: number; bank_account_id: number; period_month: string; status: string };

async function getRuns(page: Page, token: string, viharaId: number): Promise<RunSummary[]> {
  const res = await page.request.get(`${API}/api/reconciliation?vihara_id=${viharaId}`, {
    headers: authHeaders(token),
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { runs: RunSummary[] };
  return body.runs;
}

test.describe("v40 rekonsiliasi", () => {
  test("halaman utama: 3 kartu ringkasan + 3 tab, PG tab tampil Saldo 1160", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/rekonsiliasi");

    // 3 kartu ringkasan.
    await expect(page.getByText("Rekonsiliasi Bank").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("1160 · PG Clearing")).toBeVisible();
    await expect(page.getByText("2310 · Suspense")).toBeVisible();
    await expect(page.getByText("Dana Belum Teridentifikasi").first()).toBeVisible();

    // 3 tab.
    await expect(page.getByRole("button", { name: "PG Clearing (KM)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rekonsiliasi Bank" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dana Belum Teridentifikasi" })).toBeVisible();

    // Tab PG default: kotak saldo 1160 + stat box.
    await expect(page.getByText("Saldo Akun 1160 (Saat Ini)")).toBeVisible();
    await expect(page.getByText("Total Donasi Masuk (Gross)")).toBeVisible();
  });

  test("suspense: seed via API → Identifikasi → reklasifikasi → baris hilang", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    // Perlu satu page load ber-token untuk request API.
    await page.goto("/rekonsiliasi");

    const token = await getToken(page);
    const banks = await getVvgBanks(page, token);
    const bca = banks.find((b) => b.account_number === "6280-3488-88")!;

    const amount = uniqAmount(2_000_000);
    const desc = uniq("SUSP-E2E");
    await seedPenerimaan(page, token, {
      bankAccountId: bca.id,
      viharaId: bca.vihara_id,
      date: today(),
      category: "donasi_belum_teridentifikasi",
      amount,
      description: desc,
      sourceName: "Transfer tak dikenal",
    });

    await page.reload();
    await page.getByRole("button", { name: "Dana Belum Teridentifikasi" }).click();

    const row = page.getByTestId("suspense-row").filter({ hasText: fmtRp(amount) });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await row.getByRole("button", { name: "Identifikasi" }).click();

    // Modal reklasifikasi.
    await expect(page.getByText("Reklasifikasi Dana")).toBeVisible();
    await page.getByLabel("Donatur / Sumber Dana *").fill("Budi Santoso (E2E)");
    await page.getByLabel("Kategori Dana *").selectOption("dana_operasional");
    await page.getByRole("button", { name: "Simpan Reklasifikasi" }).click();

    await expect(page.getByText("Dana berhasil diidentifikasi dan direklasifikasi")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("suspense-row").filter({ hasText: fmtRp(amount) })).toHaveCount(0, { timeout: 15_000 });
  });

  test("run bank: buka run, tambah item koran cocok → match → terapkan; item manual bisa dihapus", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/rekonsiliasi");

    const token = await getToken(page);
    const banks = await getVvgBanks(page, token);
    const viharaId = banks[0].vihara_id;
    const runs = await getRuns(page, token, viharaId);
    const currentMonth = today().slice(0, 7);

    // Bank yang run bulan berjalannya BELUM completed → tombol UI masih bisa
    // membuka run in_progress (422 → run_id ditangani UI).
    const lockedBankIds = new Set(
      runs.filter((r) => r.period_month === currentMonth && r.status === "completed").map((r) => r.bank_account_id),
    );
    const target = banks.find((b) => !lockedBankIds.has(b.id));

    let seedDate: string;
    let bankAccountId: number;

    if (target) {
      // ── Path utama: lewat tombol "Rekonsiliasi Sekarang" di tab bank ──
      bankAccountId = target.id;
      seedDate = today();
    } else {
      // ── Fallback: semua bank bulan ini completed → pakai run bulan lampau ──
      bankAccountId = banks[0].id;
      seedDate = ""; // ditentukan di loop bawah
    }

    const amount = uniqAmount(3_000_000);
    const desc = uniq("REKON-E2E");

    if (target) {
      await seedPenerimaan(page, token, {
        bankAccountId,
        viharaId,
        date: seedDate,
        category: "dana_operasional",
        amount,
        description: desc,
        sourceName: "Donatur E2E",
      });

      await page.reload();
      await page.getByRole("button", { name: "Rekonsiliasi Bank" }).click();
      const brand = target.bank_name.replace(/^Bank\s+/i, "");
      const card = page.getByTestId("bank-rekon-card").filter({ hasText: brand }).first();
      await expect(card).toBeVisible({ timeout: 15_000 });
      await card.getByRole("button", { name: "Rekonsiliasi Sekarang" }).click();
      await page.waitForURL(/\/rekonsiliasi\/\d+$/, { timeout: 15_000 });
    } else {
      // Cari slot bulan lampau yang belum completed (run baru atau in_progress).
      let runId: number | null = null;
      for (let back = 1; back <= 24 && runId == null; back++) {
        const d = new Date();
        d.setDate(15);
        d.setMonth(d.getMonth() - back);
        const ym = d.toLocaleDateString("en-CA").slice(0, 7);
        const res = await page.request.post(`${API}/api/reconciliation`, {
          headers: authHeaders(token),
          data: { bank_account_id: bankAccountId, period_month: ym },
        });
        if (res.ok()) {
          runId = ((await res.json()) as { id: number }).id;
          seedDate = `${ym}-15`;
        } else if (res.status() === 422) {
          const body = (await res.json()) as { run_id?: number };
          const existing = (await getRuns(page, token, viharaId)).find((r) => r.id === body.run_id);
          if (existing && existing.status === "in_progress") {
            runId = existing.id;
            seedDate = `${ym}-15`;
          }
        }
      }
      if (runId == null) throw new Error("Tidak menemukan slot run rekonsiliasi yang bisa dipakai");

      await seedPenerimaan(page, token, {
        bankAccountId,
        viharaId,
        date: seedDate,
        category: "dana_operasional",
        amount,
        description: desc,
        sourceName: "Donatur E2E",
      });
      await page.goto(`/rekonsiliasi/${runId}`);
    }

    // ── Di halaman run: tambah item koran dengan jumlah sama → auto-match ──
    const koranDesc = uniq("KORAN-E2E");
    await page.getByLabel("Tanggal").fill(seedDate);
    await page.getByLabel("Keterangan").fill(koranDesc);
    await page.getByLabel("Jumlah (Rp)").fill(String(amount));
    await page.getByRole("button", { name: "+ Tambah" }).click();
    await expect(page.getByText("Item rekening koran ditambahkan")).toBeVisible({ timeout: 15_000 });

    // Item koran muncul di tabel matched (dipasangkan dengan penerimaan seed).
    await expect(page.getByTestId("matched-body")).toContainText(koranDesc, { timeout: 15_000 });
    await expect(page.getByText(/\d+ Cocok/).first()).toBeVisible();

    // Terapkan semua match.
    await page.getByRole("button", { name: "Terapkan Semua Match" }).click();
    await expect(page.getByText(/pasangan match diterapkan/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("✓ tersimpan").first()).toBeVisible({ timeout: 15_000 });

    // Item koran manual yang gak cocok → tampil di "Hanya Koran", bisa dihapus ✕.
    const orphanDesc = uniq("DEL-E2E");
    const orphanAmount = 7_777_001 + (Date.now() % 997);
    await page.getByLabel("Tanggal").fill(seedDate);
    await page.getByLabel("Keterangan").fill(orphanDesc);
    await page.getByLabel("Jumlah (Rp)").fill(String(orphanAmount));
    await page.getByRole("button", { name: "+ Tambah" }).click();
    const onlyKoran = page.getByTestId("only-koran");
    await expect(onlyKoran).toContainText(orphanDesc, { timeout: 15_000 });
    await page.getByLabel(`Hapus item ${orphanDesc}`).click();
    await expect(page.getByText("Item rekening koran dihapus")).toBeVisible({ timeout: 15_000 });
    await expect(onlyKoran).not.toContainText(orphanDesc, { timeout: 15_000 });
  });
});
