/**
 * v56 — Tombol Detail di antrean persetujuan (FV-50), catatan yang tidak lagi
 * menimpa deskripsi jurnal (FV-51), kategori kas kecil (FV-58), unduhan Excel
 * jurnal (FV-59), kartu kas kecil yang bisa dicocokkan (FV-60), dan Total
 * Pengeluaran dashboard yang memasukkan kas kecil (FV-61).
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { rekeningPengeluaran } from "../fixtures/rekening";
import { jurnalDariKode } from "../fixtures/jurnal";
import { uniq } from "../fixtures/uniq";

type Dibuat = { id: number; code?: string };

const HARI_INI = () => new Date().toISOString().slice(0, 10);

test.describe.configure({ mode: "serial" });

test.describe("v56 kas kecil, jurnal & dashboard", () => {
  let admin = "";
  let viharaVvg = 0;
  let rekOperasional = 0;
  let picLili = 0;

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
    rekOperasional = await rekeningPengeluaran(admin, viharaVvg);

    const pics = await apiCall<{ data?: Array<{ id: number; name: string }> } | Array<{ id: number; name: string }>>(
      admin,
      `/api/masters/petty-cash-pics?vihara_id=${viharaVvg}`,
    );
    const daftar = Array.isArray(pics.body) ? pics.body : (pics.body.data ?? []);
    picLili = daftar.find((p) => /Lili/i.test(p.name))?.id ?? daftar[0]?.id ?? 0;
  });

  // ── FV-58 ────────────────────────────────────────────────────────────────

  test("FV-58: pemakaian kas kecil wajib berkategori, dan akunnya ikut kategorinya", async () => {
    // Tanpa kategori → ditolak, bukan diam-diam jatuh ke Beban Lainnya.
    const tanpa = await apiCall<{ errors?: Record<string, string[]> }>(admin, "/api/petty-cash", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        pic_id: picLili,
        subtype: "usage",
        amount: 100000,
        vihara_id: viharaVvg,
      }),
    });
    expect(tanpa.status).toBe(422);
    expect(Object.keys(tanpa.body.errors ?? {})).toContain("category");

    // Kategori Bhikkhu → Dr 5100, bukan 6300 (contoh di Expected poin 2).
    const dibuat = await apiCall<Dibuat>(admin, "/api/petty-cash", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        pic_id: picLili,
        subtype: "usage",
        amount: 100000,
        category: "bhikkhu",
        vihara_id: viharaVvg,
        description: uniq("v56-bhikkhu"),
      }),
    });
    expect(dibuat.status).toBe(201);
    expect((await apiCall(admin, `/api/petty-cash/${dibuat.body.id}/post`, { method: "POST" })).status).toBe(200);

    const isi = await apiCall<{ category: string; counterpart_account_code: string }>(
      admin,
      `/api/petty-cash/${dibuat.body.id}`,
    );
    expect(isi.body.category, "kategorinya tersimpan").toBe("bhikkhu");
    expect(isi.body.counterpart_account_code, "akun beban mengikuti kategori").toBe("5100");
  });

  // ── FV-60 ────────────────────────────────────────────────────────────────

  test("FV-60: Saldo Awal + Pengisian − Terpakai = Saldo Saat Ini", async ({ page }) => {
    const ringkas = await apiCall<{
      pics: Array<{ id: number; saldo_awal: string; saldo: string; total_isi: string; total_pakai: string }>;
    }>(admin, `/api/petty-cash/summary?vihara_id=${viharaVvg}`);
    expect(ringkas.status).toBe(200);
    expect(ringkas.body.pics.length).toBeGreaterThan(0);

    for (const p of ringkas.body.pics) {
      const hitung =
        Number(p.saldo_awal) + Number(p.total_isi) - Number(p.total_pakai);
      expect(
        Math.round(hitung * 100) / 100,
        `kartu PIC ${p.id}: ${p.saldo_awal} + ${p.total_isi} − ${p.total_pakai} harus = ${p.saldo}`,
      ).toBe(Math.round(Number(p.saldo) * 100) / 100);
    }

    // Saldo minus ditandai merah dengan keterangannya (poin 4).
    await login(page, "admin");
    await page.goto("/petty-cash");
    const minus = ringkas.body.pics.find((p) => Number(p.saldo) < 0);
    if (minus) {
      const sel = page.getByTestId(`saldo-kini-${minus.id}`);
      await expect(sel).toBeVisible({ timeout: 15_000 });
      await expect(sel).toHaveClass(/text-km-red/);
      await expect(page.getByText("Saldo minus").first()).toBeVisible();
    }
  });

  // ── FV-61 ────────────────────────────────────────────────────────────────

  test("FV-61: Total Pengeluaran dashboard memasukkan pemakaian kas kecil", async () => {
    const tahun = new Date().getFullYear();
    const dash = await apiCall<{
      pengeluaran: { total: number; count: number; by_dana: Array<{ dana: string; total: number }> };
    }>(admin, `/api/dashboard?mode=ytd&year=${tahun}&vihara_id=${viharaVvg}`);
    expect(dash.status).toBe(200);

    const pembayaran = await apiCall<{ data: Array<{ amount: string; date: string }> }>(
      admin,
      `/api/pembayaran?per_page=200&status=posted&vihara_id=${viharaVvg}`,
    );
    const totalPembayaran = pembayaran.body.data
      .filter((p) => p.date.startsWith(String(tahun)))
      .reduce((s, p) => s + Number(p.amount), 0);

    const kasKecil = await apiCall<{ data: Array<{ amount: string; subtype: string; status: string }> }>(
      admin,
      `/api/petty-cash?per_page=200&vihara_id=${viharaVvg}`,
    );
    const totalKasKecil = kasKecil.body.data
      .filter((m) => m.subtype === "usage" && m.status === "posted")
      .reduce((s, m) => s + Number(m.amount), 0);

    expect(totalKasKecil, "perlu ada pemakaian kas kecil untuk diuji").toBeGreaterThan(0);
    expect(
      Number(dash.body.pengeluaran.total),
      "total dashboard = pengeluaran + pemakaian kas kecil",
    ).toBe(totalPembayaran + totalKasKecil);

    // Dan kas kecil tampil sebagai barisnya sendiri (poin 4).
    expect(dash.body.pengeluaran.by_dana.map((d) => d.dana)).toContain("Kas Kecil");
  });

  // ── FV-51 ────────────────────────────────────────────────────────────────

  test("FV-51: catatan tidak menimpa deskripsi baris jurnal", async () => {
    const catatan = uniq("catatan-uji");
    const bukti = uniq("BKT");
    const dibuat = await apiCall<Dibuat & { code: string }>(admin, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "transfer",
        vihara_id: viharaVvg,
        category: "biaya_operasional",
        name: "Biaya Keperluan Baksos",
        amount: 20000,
        bank_account_id: rekOperasional,
        payee_name: "Bapak andi",
        reference: bukti,
        description: catatan,
      }),
    });
    expect(dibuat.status).toBe(201);
    expect((await apiCall(admin, `/api/pembayaran/${dibuat.body.id}/post`, { method: "POST" })).status).toBe(200);

    const jurnal = await jurnalDariKode(admin, dibuat.body.code);

    // Deskripsi JE dan tiap barisnya memuat nama pengeluaran, pihak, no.
    // bukti, lalu nomor & kategori — bukan catatan penginput (poin 1 & 2).
    expect(jurnal.description ?? "").toContain("Biaya Keperluan Baksos");
    expect(jurnal.description ?? "").toContain("Bapak andi");
    expect(jurnal.description ?? "").toContain(bukti);
    expect(jurnal.description ?? "").toContain(dibuat.body.code);
    expect(jurnal.description ?? "").not.toContain(catatan);
    for (const l of jurnal.lines) {
      expect(l.description ?? "", "deskripsi baris bukan catatan").not.toContain(catatan);
      expect(l.description ?? "").toContain("Biaya Keperluan Baksos");
    }

    // Catatannya tetap tersimpan dan dikirim sebagai keterangan terpisah.
    const detail = await apiCall<{ source?: { catatan?: string | null } }>(
      admin,
      `/api/journal-entries/${jurnal.id}`,
    );
    expect(detail.body.source?.catatan).toBe(catatan);
  });

  // ── FV-50 ────────────────────────────────────────────────────────────────

  test("FV-50: antrean persetujuan punya Detail, dan bisa menyetujui dari sana", async ({
    page,
  }) => {
    const pencatat = await apiToken("bendahara");
    const rek = await rekeningPengeluaran(pencatat, viharaVvg);
    const dibuat = await apiCall<Dibuat & { code: string }>(pencatat, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "transfer",
        vihara_id: viharaVvg,
        category: "biaya_operasional",
        name: "Biaya ATK",
        amount: 33000,
        bank_account_id: rek,
        payee_name: "Toko Uji",
      }),
    });
    expect(dibuat.status).toBe(201);
    expect((await apiCall(pencatat, `/api/pembayaran/${dibuat.body.id}/submit`, { method: "POST" })).status).toBe(200);

    await login(page, "admin");
    await page.goto("/persetujuan");

    const detail = page.getByTestId(`detail-antrean-Pengeluaran-${dibuat.body.id}`);
    await expect(detail).toBeVisible({ timeout: 20_000 });
    await detail.click();

    // Komponen detail yang SAMA dengan Daftar Pengeluaran (poin 5).
    const modal = page.getByTestId("detail-pengeluaran");
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal).toContainText(dibuat.body.code);
    await expect(modal.getByTestId("tanpa-lampiran")).toBeVisible();

    // Menyetujui langsung dari detail (poin 4).
    await modal.getByTestId("setujui-detail").click();
    await expect(page.getByTestId("detail-info")).toContainText("disetujui", { timeout: 15_000 });
    expect(
      (await apiCall<{ status: string }>(admin, `/api/pembayaran/${dibuat.body.id}`)).body.status,
    ).toBe("posted");
  });

  // ── FV-59 ────────────────────────────────────────────────────────────────

  test("FV-59: Jurnal & Buku Besar bisa diunduh sebagai .xlsx", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/jurnal");

    const tombol = page.getByTestId("unduh-jurnal");
    await expect(tombol).toBeVisible({ timeout: 20_000 });

    const unduhan = page.waitForEvent("download", { timeout: 30_000 });
    await tombol.click();
    const file = await unduhan;
    expect(file.suggestedFilename()).toMatch(/^Jurnal_.*\.xlsx$/);

    // Isinya diperiksa lewat API-nya: total debit harus sama dengan kredit.
    const res = await apiCall<unknown>(admin, "/api/journal-entries/export");
    expect(res.status).toBe(200);
  });

  test("FV-59: unduhan butuh izin reports.export", async () => {
    const roles = await apiCall<Array<{ id: number; name: string; permissions: string[] }>>(
      admin,
      "/api/admin/roles",
    );
    const bendahara = roles.body.find((r) => r.name === "bendahara")!;
    // Role bendahara memang tidak punya reports.export.
    expect(bendahara.permissions).not.toContain("reports.export");

    const token = await apiToken("bendahara");
    expect((await apiCall(token, "/api/journal-entries/export")).status).toBe(403);
  });
});

/**
 * FV-52 — kas tunai sebagai kartu tersendiri di Kas & Bank, dan setoran kas
 * tunai dicatat dari baris rekening koran saat rekonsiliasi.
 */
test.describe("v56 kas tunai & setoran", () => {
  let admin = "";
  let viharaVvg = 0;
  let rekDonasi = 0;

  const BULAN = () => new Date().toISOString().slice(0, 7);

  /**
   * Periode rekonsiliasi sendiri, tiga bulan ke belakang: rekonsiliasi bulan
   * berjalan untuk rekening ini sudah dipakai skenario lain, dan satu
   * rekening hanya boleh punya satu run per periode.
   */
  const PERIODE_SETORAN = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 7);
  };
  const TANGGAL_SETORAN = () => `${PERIODE_SETORAN()}-15`;

  const kasBank = async () => {
    const res = await apiCall<{
      kas_tunai: { total: string; per_vihara: Array<{ vihara_id: number | null; saldo: string }> };
    }>(admin, `/api/kas-bank?vihara_id=${viharaVvg}`);
    expect(res.status).toBe(200);
    return res.body.kas_tunai;
  };

  const saldo1115 = async () => {
    const [y, m] = BULAN().split("-");
    const lap = await apiCall<{ posisi: { kas_setara: { rows: Array<{ code: string; balance: string }> } } }>(
      admin,
      `/api/laporan/isak35?mode=bulan&year=${y}&month=${Number(m)}&vihara_id=${viharaVvg}`,
    );
    return Number(lap.body.posisi.kas_setara.rows.find((r) => r.code === "1115")?.balance ?? 0);
  };

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
    const rek = await apiCall<{ data: Array<{ id: number; coa_account_code: string }> }>(
      admin,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}&type=bank`,
    );
    rekDonasi = rek.body.data.find((b) => b.coa_account_code === "1130")!.id;
  });

  test("FV-52: kas tunai jadi kartu dengan rincian per vihara, cocok dengan akun 1115", async ({
    page,
  }) => {
    const sebelum = await kasBank();

    // Penerimaan TUNAI langsung menambah kas tunai begitu diposting (poin 3).
    const terima = await apiCall<Dibuat>(admin, "/api/penerimaan", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "tunai",
        vihara_id: viharaVvg,
        category: "dana_bhikkhu",
        name: "Dana Catupacaya",
        amount: 1000000,
      }),
    });
    expect(terima.status).toBe(201);

    // Selama masih draft, kas tunai belum bertambah.
    expect(Number((await kasBank()).total)).toBe(Number(sebelum.total));

    expect((await apiCall(admin, `/api/penerimaan/${terima.body.id}/post`, { method: "POST" })).status).toBe(200);

    const sesudah = await kasBank();
    expect(Number(sesudah.total) - Number(sebelum.total)).toBe(1000000);
    const porsiVvg = sesudah.per_vihara.find((v) => v.vihara_id === viharaVvg);
    expect(porsiVvg, "ada rincian kas tunai per vihara").toBeTruthy();

    // Dan angkanya sama dengan saldo akun 1115 di laporan (poin 8).
    expect(Number(sesudah.total)).toBe(await saldo1115());

    // Kartunya tampil di layar, bukan sekadar teks kecil (poin 1).
    await login(page, "admin");
    await page.goto("/cash");
    await expect(page.getByTestId("kartu-kas-tunai")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("kartu-kas-tunai")).toContainText("Kas Tunai");
  });

  test("FV-52: setoran kas tunai dicatat dari rekonsiliasi, bukan menu tersendiri", async () => {
    const kasAwal = Number((await kasBank()).total);
    expect(kasAwal, "perlu ada kas tunai untuk disetor").toBeGreaterThan(0);

    const run = await apiCall<{ id: number }>(admin, "/api/reconciliation", {
      method: "POST",
      body: JSON.stringify({ bank_account_id: rekDonasi, period_month: PERIODE_SETORAN() }),
    });
    expect(run.status).toBe(201);
    const runId = run.body.id;

    try {
      const line = await apiCall<{ id: number }>(admin, `/api/reconciliation/${runId}/lines`, {
        method: "POST",
        body: JSON.stringify({
          date: TANGGAL_SETORAN(),
          description: "Setoran tunai teller",
          direction: "masuk",
          amount: 1000000,
        }),
      });
      expect(line.status).toBe(201);

      // Melebihi saldo kas tunai → ditolak dengan peringatan (poin 7).
      const kebanyakan = await apiCall<{ id: number }>(admin, `/api/reconciliation/${runId}/lines`, {
        method: "POST",
        body: JSON.stringify({
          date: TANGGAL_SETORAN(),
          description: "Setoran kebesaran",
          direction: "masuk",
          amount: kasAwal + 5_000_000,
        }),
      });
      const tolak = await apiCall<{ message?: string }>(
        admin,
        `/api/reconciliation/${runId}/lines/${kebanyakan.body.id}/setoran-tunai`,
        { method: "POST", body: JSON.stringify({ vihara_id: viharaVvg }) },
      );
      expect(tolak.status).toBe(422);
      expect(tolak.body.message ?? "").toMatch(/melebihi kas tunai/i);

      // Penandaan yang sah — dan belum membuat jurnal apa pun (poin 4).
      const tandai = await apiCall(
        admin,
        `/api/reconciliation/${runId}/lines/${line.body.id}/setoran-tunai`,
        { method: "POST", body: JSON.stringify({ vihara_id: viharaVvg }) },
      );
      expect(tandai.status).toBe(200);
      expect(Number((await kasBank()).total), "kas tunai belum berubah").toBe(kasAwal);

      // Bisa dibatalkan selama belum selesai.
      expect(
        (await apiCall(admin, `/api/reconciliation/${runId}/lines/${line.body.id}/setoran-tunai`, {
          method: "DELETE",
        })).status,
      ).toBe(200);
      expect(
        (await apiCall(admin, `/api/reconciliation/${runId}/lines/${line.body.id}/setoran-tunai`, {
          method: "POST",
          body: JSON.stringify({ vihara_id: viharaVvg }),
        })).status,
      ).toBe(200);

      // Diselesaikan → jurnal setoran terbentuk (poin 5 & 6).
      const selesai = await apiCall(admin, `/api/reconciliation/${runId}/complete`, {
        method: "POST",
        body: JSON.stringify({ bank_closing_balance: 0 }),
      });
      expect(selesai.status).toBe(200);

      expect(Number((await kasBank()).total), "kas tunai berkurang sebesar setoran").toBe(
        kasAwal - 1000000,
      );
      expect(Number((await kasBank()).total)).toBe(await saldo1115());

      const jurnal = await apiCall<{ data: Array<{ id: number; description: string }> }>(
        admin,
        `/api/journal-entries?source=setoran_tunai&per_page=10`,
      );
      expect(jurnal.body.data.length, "ada jurnal setoran").toBeGreaterThan(0);
      const detail = await apiCall<{ lines: Array<{ account_code: string; debit: string; credit: string }> }>(
        admin,
        `/api/journal-entries/${jurnal.body.data[0].id}`,
      );
      const baris = detail.body.lines;
      expect(baris.find((l) => Number(l.debit) > 0)?.account_code, "Dr rekening").toBe("1130");
      expect(baris.find((l) => Number(l.credit) > 0)?.account_code, "Kr kas tunai").toBe("1115");
    } finally {
      await apiCall(admin, `/api/reconciliation/${runId}`, { method: "DELETE" });
    }
  });
});
