/**
 * v01 — Navigasi smoke.
 * Yang diuji: setiap halaman utama render dengan judul topbar yang benar
 * sebagai admin.
 */
import { test, expect, Page } from "@playwright/test";
import { login } from "../fixtures/auth";

const PAGES: Array<{ path: string; title: string }> = [
  { path: "/dashboard", title: "Dashboard" },
  { path: "/dana", title: "Penerimaan Dana Umat" },
  { path: "/penerimaan", title: "Input Penerimaan" },
  { path: "/penerimaan/daftar", title: "Daftar Penerimaan" },
  { path: "/pembayaran", title: "Input Pengeluaran" },
  { path: "/pengeluaran", title: "Daftar Pengeluaran" },
  { path: "/riwayat", title: "Semua Transaksi" },
  { path: "/cash", title: "Kas & Bank" },
  { path: "/petty-cash", title: "Kas Kecil" },
  { path: "/rekonsiliasi", title: "Rekonsiliasi" },
  { path: "/laporan", title: "Laporan Keuangan" },
  { path: "/anggaran", title: "Anggaran" },
  { path: "/cetak", title: "Laporan Penerimaan Dana" },
  { path: "/konsolidasi", title: "Konsolidasi Yayasan" },
  { path: "/jurnal", title: "Jurnal & Buku Besar" },
  { path: "/admin/coa", title: "Master COA (Chart of Account)" },
  { path: "/admin/vihara", title: "Admin — Vihara" },
  { path: "/admin/users", title: "Admin — Users" },
  { path: "/admin/roles", title: "Admin — Roles" },
  { path: "/admin/entities", title: "Master Yayasan" },
  { path: "/admin/pengeluaran", title: "Master Pengeluaran" },
  { path: "/admin/penerimaan", title: "Master Penerimaan" },
];

async function assertPage(page: Page, path: string, title: string) {
  await page.goto(path);
  await expect(page.locator("header").getByText(title, { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("v01 nav smoke", () => {
  test("semua halaman render dengan judul yang benar (admin)", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, "admin");
    for (const { path, title } of PAGES) {
      await assertPage(page, path, title);
    }
  });
});
