/**
 * v48 — Form Jurnal Manual & format Rupiah (FV-33, FV-34, FV-35).
 *
 * Form tambah Jurnal Manual memakai istilah "Entitas" yang tidak dipakai di
 * layar mana pun selain master, dropdown-nya berisi seluruh yayasan tanpa
 * memandang jangkauan akses, dan tidak ada field Vihara sama sekali — jadi
 * jurnal manual tidak pernah masuk ke laporan per vihara.
 *
 * FV-33 ikut di sini karena satu-satunya isian nominal yang belum berformat
 * Rupiah ada di form ini (Debit/Kredit); isian nominal di layar lain sudah
 * memakai komponen MoneyInput sejak awal.
 */
import { test, expect, Page } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { uniq } from "../fixtures/uniq";

type Dibuat = { id: number };

test.describe.configure({ mode: "serial" });

async function bukaForm(page: Page) {
  await page.goto("/jurnal");
  await page.getByRole("button", { name: "+ Manual JE" }).click();
  await expect(page.getByTestId("form-yayasan")).toBeVisible({ timeout: 15_000 });
  // Pilihannya diambil dari /api/my-scope, jadi sempat berisi "Memuat…".
  await expect
    .poll(
      async () =>
        (await page.getByTestId("form-yayasan").locator("option").allTextContents()).join("|"),
      { timeout: 15_000 },
    )
    .not.toContain("Memuat");
}

test.describe("v48 jurnal: yayasan, vihara, format rupiah", () => {
  let token = "";

  /** Pinjamkan journal.create ke role bendahara selama satu blok, lalu kembalikan. */
  async function pinjamIzinJurnal(jalankan: () => Promise<void>) {
    const admin = await apiToken("admin");
    const roles = await apiCall<Array<{ id: number; name: string; permissions: string[] }>>(
      admin,
      "/api/admin/roles",
    );
    const bendahara = roles.body.find((r) => r.name === "bendahara")!;
    const semula = bendahara.permissions;
    await apiCall(admin, `/api/admin/roles/${bendahara.id}`, {
      method: "PATCH",
      body: JSON.stringify({ permissions: [...semula, "journal.create"] }),
    });
    try {
      await jalankan();
    } finally {
      await apiCall(admin, `/api/admin/roles/${bendahara.id}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: semula }),
      });
    }
  }

  let viharaVvg = 0;
  const jurnalDibuat: number[] = [];

  test.beforeAll(async () => {
    token = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
  });

  test.afterAll(async () => {
    for (const id of jurnalDibuat) {
      await apiCall(token, `/api/journal-entries/${id}`, { method: "DELETE" });
    }
  });

  test("FV-34: label Yayasan menggantikan Entitas", async ({ page }) => {
    await login(page, "admin");
    await bukaForm(page);

    const modal = page.locator("form").filter({ hasText: "Manual Journal Entry" });
    await expect(modal).toContainText("Yayasan");
    await expect(modal).not.toContainText("Entitas");
  });

  test("FV-34: pilihan yayasan hanya yang dalam jangkauan, satu pilihan langsung terpilih", async ({
    page,
  }) => {
    await login(page, "adminYayasan"); // jangkauan entity YDI
    await bukaForm(page);

    const yayasan = page.getByTestId("form-yayasan");
    const opsi = (await yayasan.locator("option").allTextContents()).filter(
      (t) => !/Pilih yayasan/.test(t),
    );
    expect(opsi.length, "hanya yayasannya sendiri").toBe(1);
    expect(opsi[0]).toMatch(/Dhammavihara/);
    // Satu pilihan → langsung terpilih, tidak perlu diklik (FV-12).
    expect(await yayasan.inputValue()).not.toBe("");
  });

  test("FV-35: ada field Vihara di bawah Yayasan, isinya sesuai jangkauan", async ({ page }) => {
    // Role tersemai yang boleh membuat jurnal semuanya berjangkauan
    // yayasan/global, jadi izinnya dipinjamkan sebentar ke bendahara (yang
    // berjangkauan satu vihara) lalu dikembalikan.
    await pinjamIzinJurnal(async () => {
      await login(page, "bendahara"); // jangkauan vihara [VVG]
      await bukaForm(page);

      const vihara = page.getByTestId("form-vihara");
      await expect(vihara).toBeVisible();
      const opsi = (await vihara.locator("option").allTextContents()).filter(
        (t) => !/Pilih vihara/.test(t),
      );
      expect(opsi.length).toBe(1);
      expect(opsi[0]).toMatch(/Vipassan/);
      expect(await vihara.inputValue(), "satu vihara → langsung terpilih").not.toBe("");
    });

  });

  test("FV-35: superadmin melihat seluruh vihara di pilihan", async ({ page }) => {
    await login(page, "admin");
    await bukaForm(page);
    const semua = (await page.getByTestId("form-vihara").locator("option").allTextContents()).filter(
      (t) => !/Pilih vihara/.test(t),
    );
    expect(semua.length).toBeGreaterThan(1);
  });

  test("FV-33: Debit & Kredit memakai pemisah ribuan, nilainya tetap angka murni", async ({
    page,
  }) => {
    await login(page, "admin");
    await bukaForm(page);

    const debit = page.getByLabel("Debit baris 1");
    await debit.fill("15000000");
    await expect(debit, "pemisah ribuan muncul saat diketik").toHaveValue("15.000.000");

    // Menempel teks berformat tetap terbaca sebagai angka.
    const kredit = page.getByLabel("Kredit baris 2");
    await kredit.fill("Rp 15.000.000");
    await expect(kredit).toHaveValue("15.000.000");

    // Huruf diabaikan, dan kosong tetap kosong — bukan "Rp 0" yang harus
    // dihapus manual.
    await kredit.fill("abc");
    await expect(kredit).toHaveValue("");
  });

  test("FV-33 & FV-35: jurnal tersimpan dengan vihara dan nominal yang benar", async ({ page }) => {
    const ket = uniq("E2E-JRNL");
    await login(page, "admin");
    await bukaForm(page);

    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));
    await page.getByLabel("Deskripsi").fill(ket);
    await page.getByLabel("Debit baris 1").fill("15000000");
    await page.getByLabel("Kredit baris 2").fill("15000000");

    // Pemilih akun ada di dalam tabel baris form, bukan di saringan halaman.
    const formJurnal = page.locator("form").filter({ hasText: "Manual Journal Entry" });
    const akun = formJurnal.locator("tbody select");
    await akun.nth(0).selectOption({ index: 1 });
    await akun.nth(1).selectOption({ index: 2 });

    await page.getByRole("button", { name: "Simpan draft" }).click();
    // Formnya tertutup, lalu barisnya muncul di tabel daftar (tbody pertama).
    await expect(formJurnal).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator("tbody").first()).toContainText(ket, { timeout: 15_000 });

    const daftar = await apiCall<{
      data: Array<{ id: number; description: string; vihara: { id: number } | null; total_debit: string }>;
    }>(token, `/api/journal-entries?q=${encodeURIComponent(ket)}`);
    const dibuat = daftar.body.data.find((j) => j.description === ket);
    expect(dibuat, "jurnalnya tersimpan").toBeTruthy();
    jurnalDibuat.push(dibuat!.id);
    expect(dibuat!.vihara?.id, "viharanya ikut tersimpan").toBe(viharaVvg);
    // Angka murni, bukan teks berformat.
    expect(Number(dibuat!.total_debit)).toBe(15_000_000);
  });

  test("FV-34 & FV-35: server menolak yayasan/vihara di luar jangkauan", async () => {
    const vihara = await viharaIdsByCode();
    const akun = await apiCall<Array<{ code: string }>>(
      token,
      "/api/coa?active=true&per_page=100",
    );
    const kodeAkun = (Array.isArray(akun.body) ? akun.body : []).slice(0, 2).map((a) => a.code);

    const body = (viharaId: number) => ({
      entity_id: 1,
      vihara_id: viharaId,
      entry_date: new Date().toLocaleDateString("en-CA"),
      description: uniq("E2E-TOLAK"),
      lines: [
        { account_code: kodeAkun[0], debit: 1000, credit: 0 },
        { account_code: kodeAkun[1], debit: 0, credit: 1000 },
      ],
    });

    await pinjamIzinJurnal(async () => {
      const bendahara = await apiToken("bendahara"); // jangkauan vihara [VVG]

      // Penolakannya harus karena JANGKAUAN, bukan karena izin: dengan vihara
      // sendiri request yang sama diterima.
      const sendiri = await apiCall<Dibuat>(bendahara, "/api/journal-entries", {
        method: "POST",
        body: JSON.stringify(body(vihara.VVG)),
      });
      expect(sendiri.status).toBe(201);
      jurnalDibuat.push(sendiri.body.id);

      // Vihara lain → 403, walau request dikirim langsung ke API.
      const lain = await apiCall(bendahara, "/api/journal-entries", {
        method: "POST",
        body: JSON.stringify(body(vihara.VBM)),
      });
      expect(lain.status).toBe(403);

      // Yayasan lain → juga ditolak.
      const yayasanLain = await apiCall(bendahara, "/api/journal-entries", {
        method: "POST",
        body: JSON.stringify({ ...body(vihara.VVG), entity_id: 999999 }),
      });
      expect([403, 422]).toContain(yayasanLain.status);
    });
  });

  test("FV-35: jurnal tanpa vihara disebut 'Tingkat yayasan', bukan tanda hubung", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/jurnal");
    // Baris data sungguhan, bukan baris "Memuat…".
    await expect(page.locator('[data-testid^="detail-je-"]').first()).toBeVisible({
      timeout: 15_000,
    });

    // Kolom Vihara tidak boleh berisi "—": entah nama vihara, entah
    // keterangan tingkat yayasan.
    const kolom = await page.locator("tbody tr td:nth-child(3)").allTextContents();
    expect(kolom.length).toBeGreaterThan(0);
    for (const t of kolom) {
      expect(t.trim()).not.toBe("—");
    }
  });
});
