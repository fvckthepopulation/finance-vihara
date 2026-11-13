/**
 * v98 — Yayasan & Vihara sebagai field di form Input Pengeluaran (FV-2).
 *
 * Sebelumnya vihara transaksi diambil dari pemilih di header. Akibatnya
 * admin yang lupa mengganti header mencatat ke vihara yang salah tanpa
 * pernah melihat kesalahannya. Sekarang transaksi menyatakan tujuannya
 * sendiri, dan header hanya menyaring tabel di bawah form.
 *
 * Yang diuji: keberadaan & urutan field, penguncian sesuai scope akun,
 * pembersihan bertingkat saat yayasan diganti, dan — yang paling penting —
 * baris tersimpan mengikuti FORM, bukan header.
 *
 * Berprefiks v98 agar jalan menjelang akhir: spec ini menambah yayasan +
 * vihara sementara yang akan mengubah hitungan di spec lain. Semua yang
 * dibuat dibersihkan di afterAll.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";

type Dibuat = { id: number };

const stamp = Date.now().toString().slice(-6);
const KODE_YAYASAN = `F${stamp}`.slice(0, 8);

let adminToken = "";
let yayasanBaruId = 0;
let viharaBaruId = 0;
let roleBaruId = 0;
let userBaruId = 0;
let viharaYdi: Record<string, number> = {};
let yayasanYdiId = 0;

test.describe.configure({ mode: "serial" });

test.describe("v98 form yayasan-vihara", () => {
  test.beforeAll(async () => {
    adminToken = await apiToken("admin");
    viharaYdi = await viharaIdsByCode();
    const vvg = await apiCall<{ entity_id: number }>(
      adminToken,
      `/api/viharas/${viharaYdi.VVG}`,
    );
    yayasanYdiId = vvg.body.entity_id;
  });

  test.afterAll(async () => {
    // Urutan penting: user dulu, baru role; API menolak menghapus role yang
    // masih dipakai.
    if (userBaruId) {
      await apiCall(adminToken, `/api/admin/users/${userBaruId}`, { method: "DELETE" });
    }
    if (roleBaruId) {
      await apiCall(adminToken, `/api/admin/roles/${roleBaruId}`, { method: "DELETE" });
    }
    if (viharaBaruId) {
      await apiCall(adminToken, `/api/viharas/${viharaBaruId}`, { method: "DELETE" });
    }
    if (yayasanBaruId) {
      await apiCall(adminToken, `/api/entities/${yayasanBaruId}`, { method: "DELETE" });
    }
  });

  test("field Yayasan & Vihara ada di atas Tanggal, dan menahan simpan", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/pembayaran");

    const yayasan = page.getByTestId("form-yayasan");
    const vihara = page.getByTestId("form-vihara");
    await expect(yayasan).toBeVisible({ timeout: 10_000 });
    await expect(vihara).toBeVisible();

    // Urutan: keduanya mendahului Tanggal.
    const urutan = await page.evaluate(() => {
      const label = (el: Element | null) =>
        el?.closest("label")?.querySelector("span")?.textContent ?? "";
      const semua = [...document.querySelectorAll("select,input")];
      const idx = (t: string) => semua.findIndex((el) => label(el).startsWith(t));
      return { yayasan: idx("Yayasan"), vihara: idx("Vihara"), tanggal: idx("Tanggal") };
    });
    expect(urutan.yayasan).toBeLessThan(urutan.tanggal);
    expect(urutan.vihara).toBeLessThan(urutan.tanggal);

    // Vihara nonaktif sampai yayasan dipilih.
    await expect(vihara).toBeDisabled();
    await yayasan.selectOption(String(yayasanYdiId));
    await expect(vihara).toBeEnabled();

    // Vihara belum dipilih → simpan tertahan, alasannya tampil.
    await expect(vihara).toHaveValue("");
    await expect(page.getByTestId("tombol-ajukan")).toBeDisabled();
    await expect(page.getByText("Pilih yayasan dan vihara dulu")).toBeVisible();

    // Begitu vihara dipilih, penahan YANG INI lepas. (Rekening sumber masih
    // menahan — itu kewajiban terpisah, diuji di v11.)
    await vihara.selectOption(String(viharaYdi.VVG));
    await expect(page.getByText("Pilih yayasan dan vihara dulu")).toHaveCount(0);

    const rekening = page.getByTestId("form-rekening");
    await expect
      .poll(async () => (await rekening.locator("option").count()) > 1)
      .toBe(true);
    await rekening.selectOption({ index: 1 });
    await expect(page.getByTestId("tombol-ajukan")).toBeEnabled();
  });

  test("penguncian field mengikuti scope akun", async ({ page }) => {
    // scope entity: yayasan terkunci, vihara bebas di dalam yayasannya.
    await login(page, "adminYayasan");
    await page.goto("/pembayaran");
    await expect(page.getByTestId("form-yayasan")).toBeDisabled({ timeout: 10_000 });
    await expect(page.getByTestId("form-vihara")).toBeEnabled();

    // scope vihara, satu vihara: dua-duanya terkunci dan sudah terisi.
    await login(page, "bendahara");
    await page.goto("/pembayaran");
    await expect(page.getByTestId("form-yayasan")).toBeDisabled({ timeout: 10_000 });
    const viharaTetap = page.getByTestId("form-vihara");
    await expect(viharaTetap).toBeDisabled();
    await expect(viharaTetap).toHaveValue(String(viharaYdi.VVG));

    // scope vihara, beberapa vihara: boleh memilih, TAPI hanya miliknya.
    await login(page, "bendaharaMulti");
    await page.goto("/pembayaran");
    const viharaMulti = page.getByTestId("form-vihara");
    await expect(viharaMulti).toBeEnabled({ timeout: 10_000 });
    // Opsi vihara dimuat async setelah select aktif — tunggu sampai terisi,
    // jangan baca isinya sekali begitu select enabled (dulu flaky: terbaca []).
    await expect
      .poll(
        async () =>
          (
            await viharaMulti.locator("option").evaluateAll((opts) =>
              opts.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
            )
          ).sort(),
        { timeout: 10_000 },
      )
      .toEqual([String(viharaYdi.VVG), String(viharaYdi.VAD)].sort());
  });

  test("ganti yayasan mengosongkan vihara dan rekening", async ({ page }) => {
    // Yayasan kedua + viharanya, supaya ada yang bisa dipindah.
    const yayasan = await apiCall<Dibuat>(adminToken, "/api/entities", {
      method: "POST",
      body: JSON.stringify({ code: KODE_YAYASAN, legal_name: `Yayasan Form ${stamp}` }),
    });
    expect(yayasan.status).toBe(201);
    yayasanBaruId = yayasan.body.id;

    const vihara = await apiCall<Dibuat>(adminToken, "/api/viharas", {
      method: "POST",
      body: JSON.stringify({
        entity_id: yayasanBaruId,
        name: `Vihara Form ${stamp}`,
        bank_name: "BNI",
        bank_account_number: `8888-${stamp}`,
        bank_account_holder: `Vihara Form ${stamp}`,
      }),
    });
    expect(vihara.status).toBe(201);
    viharaBaruId = vihara.body.id;

    await login(page, "admin");
    await page.goto("/pembayaran");

    const fYayasan = page.getByTestId("form-yayasan");
    const fVihara = page.getByTestId("form-vihara");
    const fRekening = page.getByLabel("Transfer dari Rekening");

    await expect(fYayasan).toBeEnabled({ timeout: 10_000 });
    await fYayasan.selectOption(String(yayasanYdiId));
    await fVihara.selectOption(String(viharaYdi.VVG));
    await expect
      .poll(async () => (await fRekening.locator("option").count()) > 1)
      .toBe(true);
    await fRekening.selectOption({ index: 1 });
    await expect(fRekening).not.toHaveValue("");

    // Pindah yayasan: vihara lama DAN rekeningnya dilepas, karena keduanya
    // milik yayasan lama. Yayasan baru punya dua unit — viharanya sendiri dan
    // unit Umum/Pusat yang dibuat otomatis (P-01) — jadi tidak ada yang
    // terpilih sendiri; yang penting vihara lama tidak tertinggal dan
    // pilihannya memang milik yayasan baru.
    await fYayasan.selectOption(String(yayasanBaruId));
    await expect(fVihara).not.toHaveValue(String(viharaYdi.VVG));
    await expect
      .poll(
        async () =>
          (await fVihara.locator("option").evaluateAll((o) =>
            o.map((x) => (x as HTMLOptionElement).value).filter(Boolean),
          )).sort(),
        { timeout: 10_000 },
      )
      .toContain(String(viharaBaruId));
    await fVihara.selectOption(String(viharaBaruId));
    await expect(fRekening).toHaveValue("");

    // Daftar vihara ikut berganti ke yayasan yang baru: viharanya sendiri
    // plus unit Umum/Pusat yayasan itu (P-01) — tidak ada vihara YDI.
    const opsiBaru = await fVihara.locator("option").evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
    );
    expect(opsiBaru).toContain(String(viharaBaruId));
    expect(opsiBaru).not.toContain(String(viharaYdi.VVG));
    expect(opsiBaru).not.toContain(String(viharaYdi.VAD));
  });

  test("tersimpan ke vihara dari FORM, bukan pilihan header", async ({ page }) => {
    await login(page, "admin");

    // Header sengaja diarahkan ke vihara LAIN.
    await page.goto("/dashboard");
    await page.getByLabel("Pilih vihara").selectOption(String(viharaYdi.VBM));

    await page.goto("/pembayaran");
    const fYayasan = page.getByTestId("form-yayasan");
    await expect(fYayasan).toBeEnabled({ timeout: 10_000 });
    await fYayasan.selectOption(String(yayasanYdiId));
    await page.getByTestId("form-vihara").selectOption(String(viharaYdi.VVG));

    await page.getByLabel("Jumlah (Rp) *").fill("150000");
    await page.getByLabel("Kategori Biaya *").selectOption("biaya_operasional");
    const nama = page.getByLabel("Nama Pengeluaran *");
    await expect.poll(async () => (await nama.locator("option").count()) > 1).toBe(true);
    await nama.selectOption({ index: 1 });
    const rekening = page.getByLabel("Transfer dari Rekening");
    await expect.poll(async () => (await rekening.locator("option").count()) > 1).toBe(true);
    await rekening.selectOption({ index: 1 });

    await page.getByTestId("tombol-submit").click();
    await expect(page.getByText(/disimpan dan disetujui/)).toBeVisible({ timeout: 10_000 });

    // Baris terakhir harus milik vihara FORM (VVG), bukan header (VBM),
    // dan yayasannya ikut vihara itu.
    const list = await apiCall<{ data: Array<{ vihara_id: number; entity_id: number; amount: string }> }>(
      adminToken,
      "/api/pembayaran?per_page=1",
    );
    expect(list.status).toBe(200);
    const terakhir = list.body.data[0];
    expect(terakhir.vihara_id).toBe(viharaYdi.VVG);

    const viharaVvg = await apiCall<{ entity_id: number }>(
      adminToken,
      `/api/viharas/${viharaYdi.VVG}`,
    );
    expect(terakhir.entity_id).toBe(viharaVvg.body.entity_id);
  });

  test("role tanpa izin master tetap bisa memakai form transaksi", async ({ page }) => {
    // Inti FV-12: role operasional buatan tangan sering tidak diberi
    // `entities.view` / `masters.view`. Dulu form mengambil yayasan & vihara
    // dari endpoint master itu, jadi dropdownnya terkunci DAN kosong —
    // akun yang jelas punya satu vihara tidak bisa bertransaksi sama sekali.
    const namaRole = `e2e_ops_${stamp}`;
    const email = `${namaRole}@uji.test`;

    const role = await apiCall<Dibuat>(adminToken, "/api/admin/roles", {
      method: "POST",
      body: JSON.stringify({
        name: namaRole,
        permissions: ["pembayaran.view", "pembayaran.create", "cash.view"],
      }),
    });
    expect(role.status).toBe(201);
    roleBaruId = role.body.id;

    const user = await apiCall<Dibuat>(adminToken, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Operasional Uji",
        email,
        password: "password123",
        role: namaRole,
        entity_id: yayasanYdiId,
        scope_type: "vihara",
        vihara_ids: [viharaYdi.VVG],
      }),
    });
    expect(user.status).toBe(201);
    userBaruId = user.body.id;

    // Endpoint master memang tertutup baginya — itu wajar dan tetap begitu.
    const token = await apiToken({ email, password: "password123" });
    expect((await apiCall(token, "/api/entities")).status).toBe(403);
    expect((await apiCall(token, "/api/viharas")).status).toBe(403);

    // Tapi jangkauan aksesnya sendiri boleh dibaca, tanpa izin tambahan.
    const scope = await apiCall<{ entities: unknown[]; viharas: Array<{ id: number }> }>(
      token,
      "/api/my-scope",
    );
    expect(scope.status).toBe(200);
    expect(scope.body.viharas.map((v) => v.id)).toEqual([viharaYdi.VVG]);

    // Dan di layar: kedua field BISA dibuka, terisi, bukan kosong terkunci.
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL("**/dashboard");
    await page.goto("/pembayaran");

    const fYayasan = page.getByTestId("form-yayasan");
    const fVihara = page.getByTestId("form-vihara");
    await expect(fYayasan).toBeEnabled({ timeout: 10_000 });
    await expect(fVihara).toBeEnabled();
    await expect(fYayasan).toHaveValue(String(yayasanYdiId));
    await expect(fVihara).toHaveValue(String(viharaYdi.VVG));

    // Field yang bergantung padanya pun terisi, bukan buntu.
    await expect
      .poll(async () => (await page.getByTestId("form-rekening").locator("option").count()) > 1)
      .toBe(true);
  });
});
