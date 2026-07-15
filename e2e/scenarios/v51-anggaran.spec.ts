/**
 * v51 — Anggaran (/anggaran).
 * Yang diuji: sebagai admin + vihara VVG, set Target Dana Perayaan → Simpan →
 * toast sukses; reload → nilai persist; progress bar + label % tampil.
 * Idempotent: baris yang sama ditimpa tiap run (PUT upsert).
 */
import { test, expect } from "@playwright/test";
import { login, pickViharaVVG } from "../fixtures/auth";

test.describe("v51 anggaran", () => {
  test("set target Dana Perayaan, simpan, dan persist setelah reload", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/anggaran");
    await pickViharaVVG(page);

    const input = page.getByLabel("Target Dana Perayaan");
    await expect(input).toBeVisible({ timeout: 20_000 });

    // Nilai uniq-ish per run — menimpa baris yang sama itu aman (idempotent).
    const value = 9_000_000 + (Math.floor(Math.random() * 900) + 1) * 1000;
    await input.fill(String(value));
    await expect(input).toHaveValue(value.toLocaleString("id-ID"));

    await page.getByRole("button", { name: "Simpan Anggaran" }).click();
    await expect(page.getByText("Anggaran berhasil disimpan")).toBeVisible({ timeout: 10_000 });

    await page.reload();
    const inputAfter = page.getByLabel("Target Dana Perayaan");
    await expect(inputAfter).toBeVisible({ timeout: 20_000 });
    await expect(inputAfter).toHaveValue(value.toLocaleString("id-ID"));

    // Progress bar + label % di baris Dana Perayaan.
    const row = page.locator("tr", { hasText: "Dana Perayaan" }).first();
    await expect(row.getByText(/%$/).first()).toBeVisible();
  });
});
