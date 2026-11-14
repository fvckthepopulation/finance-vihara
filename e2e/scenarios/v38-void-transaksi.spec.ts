/**
 * v38 — Pembatalan transaksi terposting (FV-14).
 *
 * Keadaan sebelumnya: DELETE hanya menerima baris draft, sedangkan UI selalu
 * memposting begitu menyimpan. Jadi transaksi salah ketik tidak bisa dihapus
 * maupun dibatalkan oleh siapa pun — termasuk superadmin.
 *
 * Yang diuji bukan sekadar "endpoint void ada", tapi hal yang membuat
 * pembatalan benar secara akuntansi: buku besar kembali netral, jejaknya
 * tersimpan, dan barisnya tetap terlihat sebagai dibatalkan.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { rekeningPengeluaran } from "../fixtures/rekening";

type Dibuat = { id: number; code: string };
type Baris = {
  id: number;
  code: string;
  status: string;
  tipe: string;
  void_reason?: string | null;
};

test.describe.configure({ mode: "serial" });

test.describe("v38 pembatalan transaksi", () => {
  let token = "";
  let viharaVvg = 0;
  let rekening = 0;
  const hariIni = new Date().toLocaleDateString("en-CA");

  test.beforeAll(async () => {
    token = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
    // Rekening untuk PENGELUARAN harus berakun 1120 sejak FV-56.
    rekening = await rekeningPengeluaran(token, viharaVvg);
  });

  async function buatPengeluaran(amount: number) {
    const dibuat = await apiCall<Dibuat>(token, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: hariIni,
        method: "transfer",
        category: "biaya_operasional",
        name: "Biaya ATK",
        amount,
        vihara_id: viharaVvg,
        bank_account_id: rekening,
      }),
    });
    expect(dibuat.status).toBe(201);
    return dibuat.body;
  }

  async function totalKeluar(): Promise<number> {
    const res = await apiCall<{ totals: { keluar: string | number } }>(
      token,
      `/api/transactions?from=${hariIni}&to=${hariIni}&vihara_id=${viharaVvg}&status=posted&per_page=1`,
    );
    return Number(res.body.totals.keluar);
  }

  test("draft tidak dibatalkan tapi dihapus; yang posted sebaliknya", async () => {
    const draft = await buatPengeluaran(12000);

    const tolak = await apiCall<{ message: string }>(
      token,
      `/api/pembayaran/${draft.id}/void`,
      { method: "POST", body: JSON.stringify({ reason: "coba batalkan draft" }) },
    );
    expect(tolak.status).toBe(422);
    expect(tolak.body.message).toContain("draft");

    expect(
      (await apiCall(token, `/api/pembayaran/${draft.id}`, { method: "DELETE" })).status,
    ).toBe(200);
  });

  test("alasan wajib diisi", async () => {
    const t = await buatPengeluaran(13000);
    await apiCall(token, `/api/pembayaran/${t.id}/post`, { method: "POST" });

    const kosong = await apiCall<{ message: string }>(token, `/api/pembayaran/${t.id}/void`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(kosong.status).toBe(422);
    expect(kosong.body.message).toContain("Alasan");

    const pendek = await apiCall(token, `/api/pembayaran/${t.id}/void`, {
      method: "POST",
      body: JSON.stringify({ reason: "x" }),
    });
    expect(pendek.status).toBe(422);

    // Bersihkan: batalkan dengan alasan yang sah.
    expect(
      (await apiCall(token, `/api/pembayaran/${t.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "pembersihan tes alasan" }),
      })).status,
    ).toBe(200);
  });

  test("pembatalan mengembalikan buku ke keadaan semula, dan jejaknya tersimpan", async () => {
    const sebelum = await totalKeluar();

    const t = await buatPengeluaran(456000);
    await apiCall(token, `/api/pembayaran/${t.id}/post`, { method: "POST" });
    expect(await totalKeluar()).toBeCloseTo(sebelum + 456000, 2);

    const batal = await apiCall(token, `/api/pembayaran/${t.id}/void`, {
      method: "POST",
      body: JSON.stringify({ reason: "Salah ketik nominal" }),
    });
    expect(batal.status).toBe(200);

    // Inti pembatalan: angkanya kembali seperti sebelum transaksi dibuat.
    expect(await totalKeluar()).toBeCloseTo(sebelum, 2);

    // Barisnya TIDAK hilang — masih terlihat, bertanda dibatalkan, lengkap
    // dengan alasannya. Kalau hilang, auditor kehilangan jejak.
    const daftar = await apiCall<{ data: Baris[] }>(
      token,
      `/api/transactions?from=${hariIni}&to=${hariIni}&vihara_id=${viharaVvg}&per_page=100`,
    );
    const baris = daftar.body.data.find((r) => r.code === t.code);
    expect(baris, "baris yang dibatalkan harus tetap tampil").toBeTruthy();
    expect(baris!.status).toBe("cancelled");
    expect(baris!.void_reason).toBe("Salah ketik nominal");

    // Tidak bisa dibatalkan dua kali.
    const lagi = await apiCall<{ message: string }>(token, `/api/pembayaran/${t.id}/void`, {
      method: "POST",
      body: JSON.stringify({ reason: "sekali lagi" }),
    });
    expect(lagi.status).toBe(422);
    expect(lagi.body.message).toContain("sudah dibatalkan");
  });

  test("butuh izin: bendahara ditolak, superadmin boleh", async () => {
    const t = await buatPengeluaran(24000);
    await apiCall(token, `/api/pembayaran/${t.id}/post`, { method: "POST" });

    const bendahara = await apiToken("bendahara");
    const ditolak = await apiCall(bendahara, `/api/pembayaran/${t.id}/void`, {
      method: "POST",
      body: JSON.stringify({ reason: "mencoba tanpa izin" }),
    });
    expect(ditolak.status).toBe(403);

    expect(
      (await apiCall(token, `/api/pembayaran/${t.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "dibatalkan oleh yang berhak" }),
      })).status,
    ).toBe(200);
  });

  test("UI: tombol Batalkan hanya bagi yang berizin, baris batal bertanda", async ({ page }) => {
    const t = await buatPengeluaran(31000);
    await apiCall(token, `/api/pembayaran/${t.id}/post`, { method: "POST" });

    // Bendahara tidak punya *.void → kolom Aksi tidak muncul sama sekali.
    await login(page, "bendahara");
    await page.goto("/riwayat");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid^="batalkan-"]')).toHaveCount(0);

    // Superadmin membatalkan lewat UI. Dicari lewat kotak pencarian supaya
    // tidak bergantung pada baris mana yang kebetulan ada di halaman 1.
    await login(page, "admin");
    await page.goto("/riwayat");
    await page.getByPlaceholder(/cari/i).fill(t.code);
    const tombol = page.getByTestId(`batalkan-Pengeluaran-${t.id}`);
    await expect(tombol).toBeVisible({ timeout: 10_000 });

    page.once("dialog", (d) => d.accept("Dibatalkan lewat UI"));
    await tombol.click();

    const badge = page.getByTestId(`status-cancelled-${t.id}`);
    await expect(badge).toBeVisible({ timeout: 10_000 });
    await expect(badge).toHaveText("Dibatalkan");
    await expect(badge).toHaveAttribute("title", "Dibatalkan lewat UI");
  });

  test("matrix: hak void tampil berketerangan, period.* disembunyikan", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/roles");
    await page.getByTestId("role-baru").click();

    for (const p of ["pembayaran.void", "penerimaan.void", "journal.void", "petty_cash.void"]) {
      await expect(page.getByTestId(`perm-${p}`)).toBeVisible();
      await expect(page.getByTestId(`perm-desc-${p}`)).toContainText("pembalik");
    }

    // period.* tidak mengatur apa pun, jadi tidak boleh bisa dicentang.
    for (const p of ["period.view", "period.close", "period.reopen"]) {
      await expect(page.getByTestId(`perm-${p}`)).toHaveCount(0);
    }

    // Keterangan yang paling dibutuhkan: cakupan masters.manage.
    await expect(page.getByTestId("perm-desc-masters.manage")).toContainText("vihara");
  });

  test("jurnal bawaan transaksi tidak bisa dibatalkan sendiri", async () => {
    // Kalau jurnal hasil pembayaran dibalik langsung, buku besar berubah
    // tapi dokumennya tetap berstatus posted — angkanya jadi tidak cocok.
    // Yang paling berbahaya: membalik jurnal PEMBALIK, karena itu
    // menghidupkan kembali transaksi yang sudah dibatalkan.
    const t = await buatPengeluaran(41000);
    await apiCall(token, `/api/pembayaran/${t.id}/post`, { method: "POST" });

    const detail = await apiCall<{ journal_entry_id: number }>(
      token,
      `/api/pembayaran/${t.id}`,
    );
    const jeAsli = detail.body.journal_entry_id;

    const tolak = await apiCall<{ message: string }>(
      token,
      `/api/journal-entries/${jeAsli}/void`,
      { method: "POST", body: JSON.stringify({ reason: "mencoba lewat jurnal" }) },
    );
    expect(tolak.status).toBe(422);
    expect(tolak.body.message).toContain("transaksi sumbernya");

    // Jalur yang benar tetap berfungsi.
    expect(
      (await apiCall(token, `/api/pembayaran/${t.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "dibatalkan lewat transaksinya" }),
      })).status,
    ).toBe(200);

    // Dan jurnal pembaliknya pun tidak bisa dibalik lagi.
    const sesudah = await apiCall<{ void_journal_entry_id: number }>(
      token,
      `/api/pembayaran/${t.id}`,
    );
    const tolakPembalik = await apiCall<{ message: string }>(
      token,
      `/api/journal-entries/${sesudah.body.void_journal_entry_id}/void`,
      { method: "POST", body: JSON.stringify({ reason: "balik lagi" }) },
    );
    expect(tolakPembalik.status).toBe(422);
  });
});
