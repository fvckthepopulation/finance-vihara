/**
 * v42 — Siklus draft → pengajuan → persetujuan (FV-20, 21, 24, 25).
 *
 * Sebelumnya "Simpan sebagai Draft" langsung memasukkan transaksi ke antrean
 * persetujuan: draft dan pengajuan tidak terbedakan, sehingga data yang belum
 * final ikut mengantre dan penginput tidak punya cara menyimpan pekerjaan
 * setengah jadi. Penyetuju pun diketik bebas di form, jadi tidak bisa
 * dipercaya untuk audit.
 *
 * Yang diuji: ketiga niat itu terpisah, tombolnya mengikuti IZIN (bukan nama
 * role), servernya menolak walau tombolnya dilewati, dan jejak persetujuan
 * dicatat sistem.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { rekeningPengeluaran } from "../fixtures/rekening";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

type Baris = {
  id: number;
  code: string;
  status: string;
  amount: string | null;
  reject_reason?: string | null;
  posted_by_user_id?: number | null;
};

test.describe.configure({ mode: "serial" });

test.describe("v42 siklus persetujuan", () => {
  let tokenAdmin = "";
  let tokenPencatat = "";
  let tokenPenyetuju = "";
  let viharaVvg = 0;
  let rekening = 0;
  let bukti = "";
  let idDraft = 0;

  test.beforeAll(async () => {
    tokenAdmin = await apiToken("admin");
    tokenPencatat = await apiToken("bendahara"); // create tanpa approve
    tokenPenyetuju = await apiToken("approver"); // approve tanpa create
    viharaVvg = (await viharaIdsByCode()).VVG;
    // Rekening untuk PENGELUARAN harus berakun 1120 sejak FV-56.
    rekening = await rekeningPengeluaran(tokenPencatat, viharaVvg);
  });

  test("FV-20 & FV-24: tombol mengikuti izin, field Disetujui oleh hilang", async ({ page }) => {
    // Pencatat: boleh menyimpan dan mengajukan, tidak boleh menyetujui.
    await login(page, "bendahara");
    await page.goto("/pembayaran");
    await expect(page.getByTestId("tombol-draft")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("tombol-ajukan")).toBeVisible();
    await expect(page.getByTestId("tombol-submit")).toHaveCount(0);
    // Penyetuju diketik bebas sudah tidak ada untuk siapa pun.
    await expect(page.locator("body")).not.toContainText("Disetujui oleh");

    // Pemegang kedua izin mendapat tombol submit langsung.
    await login(page, "admin");
    await page.goto("/pembayaran");
    await expect(page.getByTestId("tombol-submit")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("body")).not.toContainText("Disetujui oleh");
  });

  test("FV-20: draft setengah jadi tersimpan, tidak masuk antrean", async ({ page }) => {
    await login(page, "bendahara");
    await page.goto("/pembayaran");

    // Hanya vihara yang terisi — jumlah, kategori, dan rekening sengaja kosong.
    await expect(page.getByTestId("form-vihara")).not.toHaveValue("", { timeout: 10_000 });
    await page.getByTestId("tombol-draft").click();
    await expect(page.getByText(/Tersimpan sebagai draft/)).toBeVisible({ timeout: 10_000 });

    const daftar = await apiCall<{ data: Baris[] }>(
      tokenAdmin,
      `/api/transactions?status=draft&vihara_id=${viharaVvg}&per_page=100`,
    );
    const draft = daftar.body.data[0];
    expect(draft, "draft harus tersimpan").toBeTruthy();
    idDraft = draft.id;

    // Tidak ada di antrean persetujuan — itu inti laporannya.
    const antrean = await apiCall<{ data: Baris[] }>(
      tokenPenyetuju,
      `/api/transactions?status=submitted&vihara_id=${viharaVvg}&per_page=100`,
    );
    expect(antrean.body.data.some((r) => r.id === idDraft)).toBe(false);
  });

  test("FV-20: draft belum lengkap ditolak saat diajukan, dengan sebutan field", async () => {
    const gagal = await apiCall<{ message: string }>(
      tokenPencatat,
      `/api/pembayaran/${idDraft}/submit`,
      { method: "POST" },
    );
    expect(gagal.status).toBe(422);
    expect(gagal.body.message).toContain("Jumlah");

    // Dilengkapi dulu lewat jalur ubah draft, lalu diajukan.
    bukti = uniq("E2E-SIKLUS");
    const ubah = await apiCall(tokenPencatat, `/api/pembayaran/${idDraft}`, {
      method: "PATCH",
      body: JSON.stringify({
        amount: 412000,
        category: "biaya_operasional",
        name: "Biaya ATK",
        bank_account_id: rekening,
        reference: bukti,
      }),
    });
    expect(ubah.status).toBe(200);

    const ajukan = await apiCall<Baris>(tokenPencatat, `/api/pembayaran/${idDraft}/submit`, {
      method: "POST",
    });
    expect(ajukan.status).toBe(200);
    expect(ajukan.body.status).toBe("submitted");
  });

  test("FV-20: pencatat tidak bisa menyetujui sendiri, walau lewat API", async () => {
    const ditolak = await apiCall(tokenPencatat, `/api/pembayaran/${idDraft}/post`, {
      method: "POST",
    });
    expect(ditolak.status).toBe(403);
  });

  test("FV-25: antrean berisi yang diajukan, filter bawaannya Menunggu Persetujuan", async ({
    page,
  }) => {
    await login(page, "approver");
    await page.goto("/persetujuan");

    await expect(page.getByTestId("filter-status")).toHaveValue("submitted", {
      timeout: 10_000,
    });
    for (const f of [
      "filter-vihara",
      "filter-tipe",
      "filter-status",
      "filter-kategori",
      "filter-pengaju",
      "filter-cari",
      "reset-filter",
    ]) {
      await expect(page.getByTestId(f)).toBeVisible();
    }

    const baris = page.locator("tbody tr").filter({ hasText: bukti });
    await expect(baris).toHaveCount(1, { timeout: 10_000 });
    // Pengaju ikut terlihat — approver memilah antrean lewat kolom ini.
    await expect(baris.first()).toContainText("Bendahara");

    // Filter yang tidak cocok memberi keterangan, bukan error.
    await page.getByTestId("filter-cari").fill("TIDAK-ADA-INI-XYZ");
    await expect(page.getByText("Data tidak ditemukan")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("reset-filter").click();
    await expect(page.getByTestId("filter-status")).toHaveValue("submitted");
  });

  test("FV-20: ditolak beralasan, lalu diperbaiki dan diajukan ulang", async ({ page }) => {
    await login(page, "approver");
    await page.goto("/persetujuan");
    const baris = page.locator("tbody tr").filter({ hasText: bukti }).first();
    await expect(baris).toBeVisible({ timeout: 10_000 });

    page.once("dialog", (d) => d.accept("Nominal tidak sesuai kuitansi"));
    await baris.locator('[data-testid^="tolak-"]').click();
    await expect(page.getByText(/ditolak dan dikembalikan/)).toBeVisible({ timeout: 10_000 });

    const sesudah = await apiCall<Baris>(tokenAdmin, `/api/pembayaran/${idDraft}`);
    expect(sesudah.body.status).toBe("rejected");
    expect(sesudah.body.reject_reason).toBe("Nominal tidak sesuai kuitansi");

    // Yang ditolak dikembalikan, bukan dibuang: bisa diperbaiki lalu diajukan lagi.
    expect(
      (await apiCall(tokenPencatat, `/api/pembayaran/${idDraft}`, {
        method: "PATCH",
        body: JSON.stringify({ amount: 400000 }),
      })).status,
    ).toBe(200);
    const ulang = await apiCall<Baris>(tokenPencatat, `/api/pembayaran/${idDraft}/submit`, {
      method: "POST",
    });
    expect(ulang.status).toBe(200);
    expect(ulang.body.status).toBe("submitted");
    expect(ulang.body.reject_reason).toBeNull();
  });

  test("FV-24: disetujui — penyetuju tercatat sistem, bukan ketikan", async ({ page }) => {
    await login(page, "approver");
    await page.goto("/persetujuan");
    const baris = page.locator("tbody tr").filter({ hasText: bukti }).first();
    await expect(baris).toBeVisible({ timeout: 10_000 });
    await baris.locator('[data-testid^="setujui-"]').click();
    await expect(page.getByText(/disetujui dan diposting/)).toBeVisible({ timeout: 10_000 });

    const akhir = await apiCall<{
      status: string;
      posted_by?: { name: string } | null;
      journal_entry_id: number | null;
    }>(tokenAdmin, `/api/pembayaran/${idDraft}`);
    expect(akhir.body.status).toBe("posted");
    expect(akhir.body.posted_by?.name).toBeTruthy();
    expect(akhir.body.journal_entry_id).toBeTruthy();

    // Dan terbaca di Detail, bukan hanya tersimpan.
    await login(page, "admin");
    await page.goto("/pembayaran");
    await page.getByTestId(`detail-pengeluaran-${idDraft}`).click();
    const modal = page.getByTestId("detail-pengeluaran");
    await expect(modal.getByTestId("detail-status")).toContainText("Disetujui");
    await expect(modal.getByTestId("detail-penyetuju")).toContainText(
      akhir.body.posted_by!.name,
    );
  });

  test("FV-21: kolom Status ada dan tabelnya bisa disaring", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/pembayaran");

    const kolom = await page.locator("thead th").allTextContents();
    const rapi = kolom.map((t) => t.trim());
    expect(rapi).toContain("Status");
    expect(rapi.indexOf("Status")).toBeLessThan(rapi.indexOf("Aksi"));

    const filter = page.getByTestId("filter-status-tabel");
    await expect(filter).toBeVisible();
    await filter.selectOption("posted");
    await expect
      .poll(async () =>
        page.locator("tbody tr").filter({ hasText: "Menunggu Persetujuan" }).count(),
      )
      .toBe(0);
  });
});
