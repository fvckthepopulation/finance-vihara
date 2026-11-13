/**
 * v70 — KM Integration (Phase 7): PG Clearing live + drill-down KalyanaMitta.
 * Yang diuji (vihara VVG):
 *  1. Tab PG: kotak "Sudah Settle ke Bank" tampil angka riil (≥ 0) + seksi
 *     "Riwayat Settlement KalyanaMitta" (baris settlement ATAU empty state
 *     "Belum ada settlement" — DB fresh boleh kosong).
 *  2. Lifecycle penuh via webhook M2M (butuh env KM_WEBHOOK_TOKEN — cara
 *     menjalankan di e2e/README.md; SKIP bila env absen):
 *     POST donations/paid → pending tampil ref + tag Escrow →
 *     POST settlements → settled bertambah + ref muncul di Riwayat Settlement
 *     + baris pending hilang → /riwayat cari by ref → baris bertanda
 *     KalyanaMitta.
 *
 * Idempotent: km_donation_id/ref unik per run (Date.now()).
 * `reference` kini dikirim & di-search /api/transactions, jadi pencarian
 * by ref berjalan native (donor_name tetap menyertakan ref sebagai data
 * sample yang informatif).
 */
import { test, expect } from "@playwright/test";
import { login, parseRp, pickViharaVVG } from "../fixtures/auth";
import { today } from "../fixtures/uniq";

const API = process.env.E2E_API_URL ?? "http://localhost:8500";
const KM_TOKEN = (process.env.KM_WEBHOOK_TOKEN ?? "").trim();

const webhookHeaders = {
  Authorization: `Bearer ${KM_TOKEN}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

test.describe("v70 KM integration", () => {
  test("PG tab: kotak settled riil + seksi Riwayat Settlement KalyanaMitta", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/rekonsiliasi");

    // Kotak settled dengan angka riil (Rp ≥ 0).
    const box = page.getByTestId("pg-settled-box");
    await expect(box).toBeVisible({ timeout: 15_000 });
    await expect(box).toContainText("Sudah Settle ke Bank");
    const settled = parseRp(await page.getByTestId("pg-settled-total").innerText());
    expect(settled).toBeGreaterThanOrEqual(0);

    // Seksi riwayat settlement: judul + (baris settlement ATAU empty state).
    await expect(page.getByText("Riwayat Settlement KalyanaMitta")).toBeVisible();
    const rowOrEmpty = page
      .getByTestId("pg-settlement-row")
      .or(page.getByText("Belum ada settlement", { exact: true }));
    await expect(rowOrEmpty.first()).toBeVisible();
  });

  test("lifecycle webhook: paid → Escrow di pending; settlement → settled naik + riwayat; /riwayat by ref", async ({ page }) => {
    test.skip(!KM_TOKEN, "KM_WEBHOOK_TOKEN tidak diset — lihat e2e/README.md (§ v70)");

    const stamp = Date.now();
    const kmDonationId = stamp % 2_000_000_000; // integer aman + unik per run
    const donationRef = `KM-E2E-${stamp}`;
    const settlementRef = `KMS-E2E-${stamp}`;
    const amount = 123_000;
    const komisi = 5_000;

    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/rekonsiliasi");
    await expect(page.getByTestId("pg-settled-total")).toBeVisible({ timeout: 15_000 });
    const settledBefore = parseRp(await page.getByTestId("pg-settled-total").innerText());

    // ── 1. Webhook: donasi dibayar di KM ──
    const paidRes = await page.request.post(`${API}/api/webhooks/km/donations/paid`, {
      headers: webhookHeaders,
      data: {
        donation: {
          km_donation_id: kmDonationId,
          ref: donationRef,
          vihara_code: "VVG",
          category: "dana_perayaan",
          donor_name: `Donatur E2E (${donationRef})`,
          amount,
          paid_at: `${today()}T08:00:00+07:00`,
        },
      },
    });
    expect(paidRes.status(), await paidRes.text()).toBe(201);

    await page.reload();
    const pendingRow = page.getByTestId("pg-pending-row").filter({ hasText: donationRef });
    await expect(pendingRow).toHaveCount(1, { timeout: 15_000 });
    await expect(pendingRow).toContainText("Escrow");

    // ── 2. Webhook: settlement KM → bank vihara ──
    const settleRes = await page.request.post(`${API}/api/webhooks/km/settlements`, {
      headers: webhookHeaders,
      data: {
        settlement: {
          ref: settlementRef,
          vihara_code: "VVG",
          bank_account_number: "6280-3488-88",
          gross: amount,
          komisi,
          net: amount - komisi,
          settled_at: `${today()}T09:00:00+07:00`,
          km_donation_ids: [kmDonationId],
        },
      },
    });
    expect(settleRes.status(), await settleRes.text()).toBe(201);

    await page.reload();
    await expect(page.getByTestId("pg-settled-total")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => parseRp(await page.getByTestId("pg-settled-total").innerText()), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(settledBefore + amount);

    const settlementRow = page.getByTestId("pg-settlement-row").filter({ hasText: settlementRef });
    await expect(settlementRow).toHaveCount(1);
    await expect(settlementRow).toContainText("1 donasi");
    // Donasi yang sudah settle keluar dari daftar pending.
    await expect(page.getByTestId("pg-pending-row").filter({ hasText: donationRef })).toHaveCount(0);

    // ── 3. /riwayat: cari by ref → baris bertanda KalyanaMitta ──
    await page.goto("/riwayat");
    await page.getByTestId("cari-transaksi").fill(donationRef);
    const riwayatRow = page
      .locator("tbody tr")
      .filter({ hasText: "KalyanaMitta" })
      .filter({ hasText: "123.000" });
    await expect(riwayatRow.first()).toBeVisible({ timeout: 15_000 });
  });
});
