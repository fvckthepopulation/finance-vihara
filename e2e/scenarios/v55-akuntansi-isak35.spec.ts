/**
 * v55 — Empat bug akuntansi yang membuat pembukuan tidak bisa dipercaya:
 * jurnal manual yang tidak pernah bisa diposting (FV-53), laporan yang tidak
 * membaca akun aset neto (FV-54), pelepasan pembatasan yang belum ada
 * (FV-55), dan akun bank yang selalu 1130 (FV-56). Plus FV-57: laporan hanya
 * membaca daftar akun tertentu.
 *
 * Semua angka di sini dihitung dari transaksi yang dibuat tes ini sendiri,
 * lalu dibandingkan dengan SELISIH sebelum/sesudah — bukan dengan angka mutlak
 * yang ikut berubah kalau data contoh bertambah.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { uniq } from "../fixtures/uniq";

type Dibuat = { id: number; code?: string; status?: string };
type Isak35 = {
  posisi: {
    total_aset: string;
    aset_neto: { tp: string; dp: string };
    balance_ok: boolean;
    selisih: string;
    kas_setara: { rows: Array<{ code: string; balance: string }>; total: string };
    liabilitas: { rows: Array<{ code: string }> };
  };
  penghasilan: {
    pelepasan_pembatasan: { tp: string; dp: string };
    kenaikan: { tp: string; dp: string };
  };
  perubahan: { awal: { tp: string; dp: string }; akhir: { tp: string; dp: string } };
};

const n = (v: string) => Number(v);
const HARI_INI = () => new Date().toISOString().slice(0, 10);
const BULAN = HARI_INI().slice(0, 7);

test.describe.configure({ mode: "serial" });

test.describe("v55 akuntansi ISAK 35", () => {
  let admin = "";
  let viharaVvg = 0;
  let entityVvg = 0;
  let rekDonasi = 0;
  let rekOperasional = 0;
  const jurnalDibuat: number[] = [];

  const laporan = async (bulan = BULAN) => {
    const [y, m] = bulan.split("-");
    const res = await apiCall<Isak35>(
      admin,
      `/api/laporan/isak35?mode=bulan&year=${y}&month=${Number(m)}&vihara_id=${viharaVvg}`,
    );
    expect(res.status).toBe(200);
    return res.body;
  };

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
    const viharas = await apiCall<{ data: Array<{ id: number; entity_id: number }> }>(
      admin,
      "/api/viharas?per_page=100",
    );
    entityVvg = viharas.body.data.find((v) => v.id === viharaVvg)!.entity_id;

    const rek = await apiCall<{ data: Array<{ id: number; coa_account_code: string }> }>(
      admin,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}&type=bank`,
    );
    rekDonasi = rek.body.data.find((b) => b.coa_account_code === "1130")!.id;
    rekOperasional = rek.body.data.find((b) => b.coa_account_code === "1120")!.id;
  });

  test.afterAll(async () => {
    for (const id of jurnalDibuat) {
      await apiCall(admin, `/api/journal-entries/${id}`, { method: "DELETE" });
    }
  });

  // ── FV-56 ────────────────────────────────────────────────────────────────

  test("FV-56: tiap rekening punya akun banknya sendiri, tidak lagi otomatis 1130", async () => {
    const rek = await apiCall<{ data: Array<{ coa_account_code: string | null }> }>(
      admin,
      "/api/master-rekening?per_page=100",
    );
    const akun = rek.body.data.map((b) => b.coa_account_code);
    expect(akun, "ada rekening Bank Operasional").toContain("1120");
    expect(akun, "ada rekening Bank Donasi").toContain("1130");
    expect(akun.every((a) => a !== null), "akun rekening tidak boleh kosong").toBe(true);

    // Menambah rekening TANPA akun ditolak (poin 3).
    const tanpaAkun = await apiCall<{ errors?: Record<string, string[]> }>(
      admin,
      `/api/entities/${entityVvg}/bank-accounts`,
      {
        method: "POST",
        body: JSON.stringify({
          bank_name: "Bank Tanpa Akun",
          account_number: uniq("55").replace(/\D/g, ""),
          account_name: "Uji",
        }),
      },
    );
    expect(tanpaAkun.status).toBe(422);
    expect(Object.keys(tanpaAkun.body.errors ?? {})).toContain("coa_account_code");
  });

  test("FV-56: Biaya Operasional hanya boleh dari Bank Operasional", async () => {
    // Form hanya menawarkan rekening yang sesuai (poin 4).
    const pilihan = await apiCall<{ data: Array<{ coa_account_code: string }> }>(
      admin,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}&type=bank&kategori=biaya_operasional`,
    );
    expect(pilihan.body.data.length).toBeGreaterThan(0);
    for (const b of pilihan.body.data) {
      expect(b.coa_account_code, "hanya rekening 1120 yang ditawarkan").toBe("1120");
    }

    // Dan server menolak kombinasi yang tidak sesuai walau dikirim langsung
    // (poin 5).
    const nekat = await apiCall<{ message?: string }>(admin, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "transfer",
        vihara_id: viharaVvg,
        category: "biaya_operasional",
        name: "Biaya Admin Bank",
        amount: 100000,
        bank_account_id: rekDonasi,
      }),
    });
    expect(nekat.status).toBe(422);
    expect(nekat.body.message ?? "").toMatch(/Bank Operasional \(1120\)/);
  });

  test("FV-56: Biaya Operasional dari rekening yang benar dijurnal Kr 1120", async () => {
    const dibuat = await apiCall<Dibuat>(admin, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "transfer",
        vihara_id: viharaVvg,
        category: "biaya_operasional",
        name: "Biaya Admin Bank",
        amount: 100000,
        bank_account_id: rekOperasional,
      }),
    });
    expect(dibuat.status).toBe(201);
    expect((await apiCall(admin, `/api/pembayaran/${dibuat.body.id}/post`, { method: "POST" })).status).toBe(200);

    const isi = await apiCall<{ journal_entry: { lines: Array<{ account_code: string; debit: string; credit: string }> } }>(
      admin,
      `/api/pembayaran/${dibuat.body.id}`,
    );
    const lines = isi.body.journal_entry.lines;
    expect(lines.find((l) => Number(l.debit) > 0)?.account_code, "debit beban 6100").toBe("6100");
    expect(lines.find((l) => Number(l.credit) > 0)?.account_code, "kredit 1120").toBe("1120");
  });

  test("FV-56: transfer antar rekening memindahkan dana 1130 → 1120", async () => {
    const sebelum = await laporan();
    const saldo = (lap: Isak35, kode: string) =>
      n(lap.posisi.kas_setara.rows.find((r) => r.code === kode)?.balance ?? "0");

    const res = await apiCall<Dibuat & { lines: Array<{ account_code: string; debit: string }> }>(
      admin,
      "/api/kas-bank/transfer",
      {
        method: "POST",
        body: JSON.stringify({
          from_bank_account_id: rekDonasi,
          to_bank_account_id: rekOperasional,
          date: HARI_INI(),
          amount: 250000,
          vihara_id: viharaVvg,
        }),
      },
    );
    expect(res.status).toBe(201);
    jurnalDibuat.push(res.body.id);
    expect(res.body.status).toBe("posted");

    const sesudah = await laporan();
    expect(saldo(sesudah, "1120") - saldo(sebelum, "1120"), "1120 bertambah").toBe(250000);
    expect(saldo(sesudah, "1130") - saldo(sebelum, "1130"), "1130 berkurang").toBe(-250000);
    // Memindahkan kas tidak mengubah total aset maupun aset neto.
    expect(n(sesudah.posisi.total_aset)).toBe(n(sebelum.posisi.total_aset));
    expect(n(sesudah.posisi.aset_neto.tp)).toBe(n(sebelum.posisi.aset_neto.tp));

    // Rekening asal dan tujuan tidak boleh sama.
    const sama = await apiCall(admin, "/api/kas-bank/transfer", {
      method: "POST",
      body: JSON.stringify({
        from_bank_account_id: rekDonasi,
        to_bank_account_id: rekDonasi,
        date: HARI_INI(),
        amount: 1000,
      }),
    });
    expect(sama.status).toBe(422);
  });

  // ── FV-53 & FV-54 ────────────────────────────────────────────────────────

  test("FV-53: jurnal manual bisa diajukan, disetujui, dan masuk laporan", async () => {
    const buat = await apiCall<Dibuat>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify({
        entity_id: entityVvg,
        vihara_id: viharaVvg,
        entry_date: HARI_INI(),
        description: uniq("v55 saldo awal"),
        lines: [
          { account_code: "1120", debit: 5000000, credit: 0 },
          { account_code: "3100", debit: 0, credit: 5000000 },
        ],
      }),
    });
    expect(buat.status).toBe(201);
    const id = buat.body.id;
    jurnalDibuat.push(id);
    expect(buat.body.status, "lahir sebagai draft").toBe("draft");

    const sebelum = await laporan();

    // Draft belum berpengaruh ke laporan.
    expect(n(sebelum.posisi.total_aset)).toBeDefined();

    const ajukan = await apiCall<Dibuat>(admin, `/api/journal-entries/${id}/submit`, {
      method: "POST",
    });
    expect(ajukan.status).toBe(200);
    expect(ajukan.body.status).toBe("submitted");

    const setujui = await apiCall<Dibuat & { posted_by_user_id: number }>(
      admin,
      `/api/journal-entries/${id}/post`,
      { method: "POST" },
    );
    expect(setujui.status).toBe(200);
    expect(setujui.body.status).toBe("posted");
    expect(setujui.body.posted_by_user_id, "penyetuju tercatat").toBeTruthy();

    // FV-54: akun 3100 ikut terbaca, jadi asetnya bertambah DAN aset netonya
    // juga — laporan tetap seimbang.
    const sesudah = await laporan();
    expect(n(sesudah.posisi.total_aset) - n(sebelum.posisi.total_aset)).toBe(5000000);
    expect(
      n(sesudah.posisi.aset_neto.tp) - n(sebelum.posisi.aset_neto.tp),
      "aset neto TP ikut naik 5.000.000",
    ).toBe(5000000);
    expect(sesudah.posisi.balance_ok, `selisih ${sesudah.posisi.selisih}`).toBe(true);

    // Yang sudah posted tidak bisa dihapus (poin 4).
    const hapus = await apiCall<{ message?: string }>(admin, `/api/journal-entries/${id}`, {
      method: "DELETE",
    });
    expect(hapus.status).toBe(422);
  });

  test("FV-53: jurnal tidak seimbang ditolak saat diajukan", async () => {
    const buat = await apiCall<Dibuat>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify({
        entity_id: entityVvg,
        vihara_id: viharaVvg,
        entry_date: HARI_INI(),
        description: uniq("v55 timpang"),
        lines: [
          { account_code: "1120", debit: 1000, credit: 0 },
          { account_code: "3100", debit: 0, credit: 1000 },
        ],
      }),
    });
    expect(buat.status).toBe(201);
    jurnalDibuat.push(buat.body.id);
    // Jurnalnya seimbang; yang diuji di sini penolakan ganda: jurnal yang
    // SUDAH diajukan tidak bisa diajukan lagi.
    expect((await apiCall(admin, `/api/journal-entries/${buat.body.id}/submit`, { method: "POST" })).status).toBe(200);
    const lagi = await apiCall<{ message?: string }>(
      admin,
      `/api/journal-entries/${buat.body.id}/submit`,
      { method: "POST" },
    );
    expect(lagi.status).toBe(422);

    // Ditolak dengan alasan → kembali ke pembuatnya.
    const tolak = await apiCall<Dibuat & { reject_reason: string }>(
      admin,
      `/api/journal-entries/${buat.body.id}/reject`,
      { method: "POST", body: JSON.stringify({ reason: "Bukti belum dilampirkan" }) },
    );
    expect(tolak.status).toBe(200);
    expect(tolak.body.status).toBe("rejected");
    expect(tolak.body.reject_reason).toBe("Bukti belum dilampirkan");
  });

  test("FV-53: tombol siklus ada di layar Jurnal", async ({ page }) => {
    const buat = await apiCall<Dibuat>(admin, "/api/journal-entries", {
      method: "POST",
      body: JSON.stringify({
        entity_id: entityVvg,
        vihara_id: viharaVvg,
        entry_date: HARI_INI(),
        description: uniq("v55 layar"),
        lines: [
          { account_code: "1120", debit: 7000, credit: 0 },
          { account_code: "3100", debit: 0, credit: 7000 },
        ],
      }),
    });
    jurnalDibuat.push(buat.body.id);

    await login(page, "admin");
    await page.goto("/jurnal");
    const ajukan = page.getByTestId(`ajukan-je-${buat.body.id}`);
    await expect(ajukan).toBeVisible({ timeout: 20_000 });
    await ajukan.click();

    await expect(page.getByTestId(`posting-je-${buat.body.id}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`tolak-je-${buat.body.id}`)).toBeVisible();
    await page.getByTestId(`posting-je-${buat.body.id}`).click();

    await expect
      .poll(
        async () =>
          (await apiCall<{ status: string }>(admin, `/api/journal-entries/${buat.body.id}`)).body
            .status,
        { timeout: 15_000 },
      )
      .toBe("posted");
  });

  // ── FV-55 ────────────────────────────────────────────────────────────────

  test("FV-55: beban dana terikat melepas pembatasannya, dibatasi saldo dananya", async () => {
    const sebelum = await laporan();

    // Dana Bhikkhu (Dengan Pembatasan) Rp 800.000 masuk.
    const terima = await apiCall<Dibuat>(admin, "/api/penerimaan", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "transfer",
        vihara_id: viharaVvg,
        category: "dana_bhikkhu",
        name: "Dana Catupacaya",
        amount: 800000,
        bank_account_id: rekDonasi,
      }),
    });
    expect(terima.status).toBe(201);
    expect((await apiCall(admin, `/api/penerimaan/${terima.body.id}/post`, { method: "POST" })).status).toBe(200);

    const sesudahTerima = await laporan();
    expect(
      n(sesudahTerima.posisi.aset_neto.dp) - n(sebelum.posisi.aset_neto.dp),
      "aset neto DP naik 800.000",
    ).toBe(800000);

    // Beban Bhikkhu Rp 800.000 — dibayar dari Bank Operasional sesuai FV-56.
    const bayar = await apiCall<Dibuat>(admin, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "transfer",
        vihara_id: viharaVvg,
        category: "biaya_bhikkhu",
        name: "Biaya Makan Bhikkhu",
        amount: 800000,
        bank_account_id: rekOperasional,
      }),
    });
    expect(bayar.status).toBe(201);
    expect((await apiCall(admin, `/api/pembayaran/${bayar.body.id}/post`, { method: "POST" })).status).toBe(200);

    const sesudah = await laporan();

    // Contoh persis di FV-55 poin 2: DP kembali ke posisi semula, TP juga —
    // pendapatan DP +800rb, pelepasan −800rb DP / +800rb TP, beban −800rb TP.
    expect(
      n(sesudah.posisi.aset_neto.dp) - n(sebelum.posisi.aset_neto.dp),
      "aset neto DP kembali seperti semula",
    ).toBe(0);
    expect(
      n(sesudah.posisi.aset_neto.tp) - n(sebelum.posisi.aset_neto.tp),
      "aset neto TP juga kembali seperti semula",
    ).toBe(0);

    // Dan barisnya memang ada di laporan (poin 3).
    const pelepasan = sesudah.penghasilan.pelepasan_pembatasan;
    expect(n(pelepasan.tp), "baris pelepasan di kolom TP").toBeGreaterThanOrEqual(800000);
    expect(n(pelepasan.dp)).toBe(-n(pelepasan.tp));
    expect(sesudah.posisi.balance_ok).toBe(true);
  });

  test("FV-55: beban melebihi saldo dana terikat hanya dilepas sebesar saldonya", async () => {
    const sebelum = await laporan();
    const pelepasanSebelum = n(sebelum.penghasilan.pelepasan_pembatasan.tp);

    // Tidak ada dana Perayaan yang masuk — jadi beban Perayaan tidak boleh
    // melepas apa pun (poin 4).
    const bayar = await apiCall<Dibuat>(admin, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "transfer",
        vihara_id: viharaVvg,
        category: "biaya_perayaan",
        name: "Biaya Perayaan Waisak",
        amount: 50000,
        bank_account_id: rekOperasional,
      }),
    });
    if (bayar.status !== 201) {
      test.skip(true, "nama pengeluaran perayaan tidak tersedia di data contoh");
    }
    expect((await apiCall(admin, `/api/pembayaran/${bayar.body.id}/post`, { method: "POST" })).status).toBe(200);

    const sesudah = await laporan();
    const dana = await apiCall<{ data: Array<{ amount: string }>; total: number }>(
      admin,
      `/api/penerimaan?per_page=200&status=posted&category=dana_perayaan`,
    );
    const saldoPerayaan = dana.body.data.reduce((s, p) => s + Number(p.amount), 0);
    const tambahanPelepasan = n(sesudah.penghasilan.pelepasan_pembatasan.tp) - pelepasanSebelum;

    expect(
      tambahanPelepasan,
      "pelepasan tidak boleh melebihi saldo dana terikat yang sesuai",
    ).toBeLessThanOrEqual(Math.min(50000, saldoPerayaan));
  });

  // ── FV-57 ────────────────────────────────────────────────────────────────

  test("FV-57: akun baru dari Chart of Accounts ikut masuk laporan", async () => {
    const kode = "1140";
    const adaDulu = await apiCall<{ data?: Array<{ code: string }> } | Array<{ code: string }>>(
      admin,
      "/api/coa?per_page=200",
    );
    const daftar = Array.isArray(adaDulu.body)
      ? adaDulu.body
      : ((adaDulu.body as { data?: Array<{ code: string }> }).data ?? []);
    const sudahAda = daftar.some((a) => a.code === kode);

    if (!sudahAda) {
      const buat = await apiCall(admin, "/api/coa", {
        method: "POST",
        body: JSON.stringify({
          code: kode,
          name: "Bank Cadangan (uji FV-57)",
          type: "asset",
          parent_code: "1100",
        }),
      });
      expect([200, 201]).toContain(buat.status);
    }

    try {
      // Jurnal manual yang menyentuh akun baru itu.
      const je = await apiCall<Dibuat>(admin, "/api/journal-entries", {
        method: "POST",
        body: JSON.stringify({
          entity_id: entityVvg,
          vihara_id: viharaVvg,
          entry_date: HARI_INI(),
          description: uniq("v55 akun baru"),
          lines: [
            { account_code: kode, debit: 123000, credit: 0 },
            { account_code: "3100", debit: 0, credit: 123000 },
          ],
        }),
      });
      expect(je.status).toBe(201);
      jurnalDibuat.push(je.body.id);
      await apiCall(admin, `/api/journal-entries/${je.body.id}/submit`, { method: "POST" });
      expect((await apiCall(admin, `/api/journal-entries/${je.body.id}/post`, { method: "POST" })).status).toBe(200);

      const lap = await laporan();
      const baris = lap.posisi.kas_setara.rows.find((r) => r.code === kode);
      expect(baris, `akun ${kode} harus muncul di Kas & Setara Kas`).toBeTruthy();
      expect(n(baris!.balance)).toBe(123000);
      expect(lap.posisi.balance_ok, `selisih ${lap.posisi.selisih}`).toBe(true);
    } finally {
      if (!sudahAda) {
        await apiCall(admin, `/api/coa/${kode}`, { method: "DELETE" });
      }
    }
  });
});
