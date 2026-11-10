/**
 * v32 — Hirarki akses Yayasan -> Vihara.
 *
 * Yang diuji: satu yayasan menaungi beberapa vihara, dan tiga tingkat akses
 * benar-benar terpisah, baik di UI maupun di HTTP:
 *
 *   global (admin tertinggi) -> semua yayasan, semua vihara
 *   entity (tingkat yayasan) -> semua vihara di yayasannya + konsolidasi
 *   vihara                   -> HANYA vihara yang ditugaskan (1..n),
 *                               tidak pernah melihat vihara lain
 *
 * Penegakan diuji di dua lapis: tampilan (menu, pemilih vihara, angka) DAN
 * API langsung, karena "tidak terlihat di UI" bukan jaminan isolasi.
 */
import { test, expect } from "@playwright/test";
import {
  apiCall,
  apiMe,
  apiToken,
  login,
  parseRp,
  viharaIdsByCode,
} from "../fixtures/auth";

type Penerimaan = { vihara_id: number };
type Paginated<T> = { data: T[] };

/**
 * Pastikan tiap vihara punya penerimaan posted, supaya perbedaan angka
 * antar tingkat akses benar-benar terukur. Tanpa ini, "bendahara VVG" dan
 * "pengawas yayasan" bisa sama-sama melihat angka yang sama dan test
 * kehilangan daya buktinya.
 */
async function seedPenerimaanPerVihara(): Promise<void> {
  const admin = await apiToken("admin");
  const codes = await viharaIdsByCode();
  const tanggal = new Date().toLocaleDateString("en-CA");

  for (const code of ["VVG", "VBM", "VAD"]) {
    const dibuat = await apiCall<{ id: number }>(admin, "/api/penerimaan", {
      method: "POST",
      body: JSON.stringify({
        vihara_id: codes[code],
        date: tanggal,
        method: "tunai",
        category: "dana_paramita",
        amount: 50_000,
        description: `seed hirarki akses ${code}`,
      }),
    });
    if (dibuat.status === 201) {
      // Hanya transaksi posted yang masuk dashboard & laporan.
      await apiCall(admin, `/api/penerimaan/${dibuat.body.id}/post`, { method: "POST" });
    }
  }
}

test.describe("v32 hirarki akses", () => {
  test.beforeAll(async () => {
    await seedPenerimaanPerVihara();
  });

  // -------------------------------------------------------------------
  // 1. Profil scope — sumber kebenaran untuk seluruh UI
  // -------------------------------------------------------------------

  test("profil /me melaporkan tingkat akses tiap peran", async () => {
    const codes = await viharaIdsByCode();

    const admin = await apiMe(await apiToken("admin"));
    expect(admin.scope_type).toBe("global");
    expect(admin.vihara_ids).toBeNull(); // null = tanpa batas
    expect(admin.can_see_yayasan_level).toBe(true);

    const yayasan = await apiMe(await apiToken("adminYayasan"));
    expect(yayasan.scope_type).toBe("entity");
    expect(yayasan.can_see_yayasan_level).toBe(true);
    expect(yayasan.vihara_ids).toEqual(
      expect.arrayContaining([codes.VVG, codes.VBM, codes.VAD]),
    );

    const satu = await apiMe(await apiToken("bendahara"));
    expect(satu.scope_type).toBe("vihara");
    expect(satu.vihara_ids).toEqual([codes.VVG]);
    // Pemegang scope vihara tidak pernah jadi "tingkat yayasan".
    expect(satu.can_see_yayasan_level).toBe(false);

    const banyak = await apiMe(await apiToken("bendaharaMulti"));
    expect(banyak.scope_type).toBe("vihara");
    expect(banyak.vihara_ids).toHaveLength(2);
    expect(banyak.vihara_ids).toEqual(
      expect.arrayContaining([codes.VVG, codes.VAD]),
    );
    expect(banyak.vihara_ids).not.toContain(codes.VBM);
    expect(banyak.can_see_yayasan_level).toBe(false);
  });

  // -------------------------------------------------------------------
  // 2. Isolasi data lewat API — lapis yang sesungguhnya menjaga
  // -------------------------------------------------------------------

  test("daftar penerimaan hanya berisi vihara yang boleh diakses", async () => {
    const codes = await viharaIdsByCode();

    const satu = await apiCall<Paginated<Penerimaan>>(
      await apiToken("bendahara"),
      "/api/penerimaan",
    );
    const viharaSatu = new Set(satu.body.data.map((r) => r.vihara_id));
    expect([...viharaSatu].every((id) => id === codes.VVG)).toBe(true);

    const banyak = await apiCall<Paginated<Penerimaan>>(
      await apiToken("bendaharaMulti"),
      "/api/penerimaan",
    );
    const viharaBanyak = new Set(banyak.body.data.map((r) => r.vihara_id));
    expect(viharaBanyak.has(codes.VBM)).toBe(false);
    expect(
      [...viharaBanyak].every((id) => id === codes.VVG || id === codes.VAD),
    ).toBe(true);
  });

  test("meminta vihara lain secara eksplisit ditolak 403", async () => {
    const codes = await viharaIdsByCode();
    const token = await apiToken("bendahara"); // hanya VVG

    // Setiap endpoint ber-dimensi vihara harus menolak, bukan hanya
    // mengembalikan data kosong.
    for (const path of [
      `/api/penerimaan?vihara_id=${codes.VBM}`,
      `/api/pembayaran?vihara_id=${codes.VBM}`,
      `/api/kas-bank?vihara_id=${codes.VBM}`,
      `/api/petty-cash?vihara_id=${codes.VBM}`,
      `/api/laporan/isak35?vihara_id=${codes.VBM}`,
      `/api/dashboard?vihara_id=${codes.VBM}`,
      `/api/transactions?vihara_id=${codes.VBM}`,
      `/api/viharas/${codes.VBM}`,
    ]) {
      const res = await apiCall(token, path);
      expect(res.status, `${path} harus 403`).toBe(403);
    }

    // Viharanya sendiri tetap boleh.
    const sendiri = await apiCall(token, `/api/penerimaan?vihara_id=${codes.VVG}`);
    expect(sendiri.status).toBe(200);
  });

  test("user multi-vihara: boleh viharanya, ditolak di luar itu", async () => {
    const codes = await viharaIdsByCode();
    const token = await apiToken("bendaharaMulti"); // VVG + VAD

    expect((await apiCall(token, `/api/penerimaan?vihara_id=${codes.VVG}`)).status).toBe(200);
    expect((await apiCall(token, `/api/penerimaan?vihara_id=${codes.VAD}`)).status).toBe(200);
    expect((await apiCall(token, `/api/penerimaan?vihara_id=${codes.VBM}`)).status).toBe(403);
  });

  test("konsolidasi yayasan tertutup bagi pemegang scope vihara", async () => {
    expect((await apiCall(await apiToken("bendahara"), "/api/laporan/konsolidasi")).status).toBe(403);
    expect((await apiCall(await apiToken("bendaharaMulti"), "/api/laporan/konsolidasi")).status).toBe(403);
    expect((await apiCall(await apiToken("pengawas"), "/api/laporan/konsolidasi")).status).toBe(200);
    expect((await apiCall(await apiToken("adminYayasan"), "/api/laporan/konsolidasi")).status).toBe(200);
    expect((await apiCall(await apiToken("admin"), "/api/laporan/konsolidasi")).status).toBe(200);
  });

  test("daftar vihara ikut hirarki, bukan daftar penuh", async () => {
    const jumlah = async (u: Parameters<typeof apiToken>[0]) => {
      const res = await apiCall<Paginated<unknown>>(await apiToken(u), "/api/viharas");
      return res.body.data.length;
    };

    expect(await jumlah("bendahara")).toBe(1); // VVG saja
    expect(await jumlah("bendaharaMulti")).toBe(2); // VVG + VAD
    expect(await jumlah("pengawas")).toBeGreaterThanOrEqual(3); // seluruh yayasan
    expect(await jumlah("admin")).toBeGreaterThanOrEqual(3);
  });

  test("role memisahkan APA yang boleh dari DI MANA boleh", async () => {
    // pengawas & adminYayasan sama-sama scope entity, tapi beda hak:
    // pengawas read-only, adminYayasan boleh kelola pengguna.
    const pengawas = await apiToken("pengawas");
    const yayasan = await apiToken("adminYayasan");

    expect((await apiCall(pengawas, "/api/admin/users")).status).toBe(403);
    expect((await apiCall(yayasan, "/api/admin/users")).status).toBe(200);

    // Keduanya tetap boleh membaca laporan seluruh yayasan.
    expect((await apiCall(pengawas, "/api/laporan/konsolidasi")).status).toBe(200);
    expect((await apiCall(yayasan, "/api/laporan/konsolidasi")).status).toBe(200);

    // Definisi role tetap hak admin tertinggi saja.
    const buatRole = { method: "POST", body: JSON.stringify({ name: "role_uji_e2e" }) };
    expect((await apiCall(yayasan, "/api/admin/roles", buatRole)).status).toBe(403);
  });

  // -------------------------------------------------------------------
  // 3. Tampilan mengikuti hirarki
  // -------------------------------------------------------------------

  test("scope satu vihara: chip terkunci, tanpa menu Konsolidasi", async ({ page }) => {
    await login(page, "bendahara");

    // Chip statis, bukan dropdown — tidak ada cara berpindah vihara.
    await expect(page.getByTestId("vihara-fixed")).toBeVisible();
    await expect(page.getByTestId("vihara-selector")).toHaveCount(0);

    await expect(
      page.getByRole("link", { name: "Konsolidasi Yayasan" }),
    ).toHaveCount(0);
  });

  test("scope beberapa vihara: dropdown HANYA berisi vihara miliknya", async ({ page }) => {
    await login(page, "bendaharaMulti");

    const selector = page.getByTestId("vihara-selector");
    await expect(selector).toBeVisible();

    // "Semua Vihara" + tepat 2 vihara miliknya.
    await expect
      .poll(async () => await selector.locator("option").count(), { timeout: 10_000 })
      .toBe(3);

    const labels = await selector.locator("option").allTextContents();
    expect(labels.some((l) => l.includes("Vipassan"))).toBe(true); // VVG
    expect(labels.some((l) => l.includes("Ananda"))).toBe(true); // VAD
    // Vihara yang bukan haknya tidak boleh muncul sama sekali.
    expect(labels.some((l) => l.includes("Buddhametta"))).toBe(false); // VBM

    // Beberapa vihara tetap BUKAN tingkat yayasan.
    await expect(
      page.getByRole("link", { name: "Konsolidasi Yayasan" }),
    ).toHaveCount(0);
  });

  test("scope yayasan: dropdown penuh + menu Konsolidasi tersedia", async ({ page }) => {
    await login(page, "pengawas");

    const selector = page.getByTestId("vihara-selector");
    await expect(selector).toBeVisible();
    await expect
      .poll(async () => await selector.locator("option").count(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(4); // Semua Vihara + >= 3 vihara

    await expect(
      page.getByRole("link", { name: "Konsolidasi Yayasan" }),
    ).toBeVisible();
  });

  test("angka dashboard mengikuti jangkauan akses, bukan seluruh yayasan", async ({ page }) => {
    const totalDi = async (user: Parameters<typeof login>[1]): Promise<number> => {
      await page.goto("/login");
      await page.evaluate(() => window.localStorage.clear());
      await login(page, user);
      await page.goto("/dashboard");
      const el = page.getByTestId("dashboard-total-penerimaan");
      await expect(el).toBeVisible({ timeout: 15_000 });
      // Angka dimuat async — tunggu sampai stabil (bukan 0 sementara).
      await page.waitForTimeout(600);
      return parseRp(await el.innerText());
    };

    const satuVihara = await totalDi("bendahara"); // VVG
    const duaVihara = await totalDi("bendaharaMulti"); // VVG + VAD
    const seYayasan = await totalDi("pengawas"); // VVG + VBM + VAD

    // Angka harus bertingkat sesuai cakupan: makin luas akses, makin besar
    // (atau sama, kalau vihara lain kebetulan belum punya transaksi).
    expect(duaVihara).toBeGreaterThanOrEqual(satuVihara);
    expect(seYayasan).toBeGreaterThanOrEqual(duaVihara);

    // Dan harus benar-benar BEDA — kalau sama persis, berarti scoping tidak
    // berpengaruh sama sekali dan test ini kehilangan maknanya.
    expect(seYayasan).toBeGreaterThan(satuVihara);
  });

  // -------------------------------------------------------------------
  // 4. Pengelolaan hirarki lewat UI admin
  // -------------------------------------------------------------------

  test("halaman admin menampilkan jangkauan akses tiap pengguna", async ({ page }) => {
    await login(page, "adminYayasan");
    await page.goto("/admin/users");

    const baris = (email: string) => page.getByTestId(`user-row-${email}`);

    await expect(baris("admin@vihara.test")).toContainText("Global");
    await expect(baris("pengawas@ydi.test")).toContainText("Yayasan");
    await expect(baris("bendahara@vvg.test")).toContainText("VVG");

    // User multi-vihara menampilkan KEDUA viharanya, tanpa VBM.
    const multi = baris("bendahara.multi@ydi.test");
    await expect(multi).toContainText("VVG");
    await expect(multi).toContainText("VAD");
    await expect(multi).not.toContainText("VBM");
  });

  test("admin yayasan tidak bisa menaikkan hak ke tingkat global", async () => {
    const token = await apiToken("adminYayasan");

    // Lewat UI pilihan "Global" memang ada, tapi API-lah yang menolak —
    // itu yang menentukan.
    const naikTingkat = await apiCall(token, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Percobaan Eskalasi",
        email: `eskalasi-${Date.now()}@uji.test`,
        password: "password123",
        role: "superadmin",
        scope_type: "global",
      }),
    });
    expect(naikTingkat.status).toBe(403);
  });

  test("scope vihara wajib menunjuk minimal satu vihara", async () => {
    const token = await apiToken("adminYayasan");
    const res = await apiCall(token, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Tanpa Vihara",
        email: `tanpa-vihara-${Date.now()}@uji.test`,
        password: "password123",
        role: "bendahara",
        scope_type: "vihara",
        vihara_ids: [],
      }),
    });
    expect(res.status).toBe(422);
  });

  test("pengguna baru dengan dua vihara hanya melihat dua vihara itu", async ({ page }) => {
    const codes = await viharaIdsByCode();
    const admin = await apiToken("admin");
    const email = `dua-vihara-${Date.now()}@uji.test`;

    const dibuat = await apiCall<{ id: number }>(admin, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Bendahara VBM+VAD",
        email,
        password: "password123",
        role: "bendahara",
        scope_type: "vihara",
        vihara_ids: [codes.VBM, codes.VAD],
      }),
    });
    expect(dibuat.status).toBe(201);

    try {
      const token = await apiToken({ email, password: "password123" });
      const me = await apiMe(token);
      expect(me.vihara_ids).toEqual(
        expect.arrayContaining([codes.VBM, codes.VAD]),
      );
      expect(me.vihara_ids).toHaveLength(2);
      expect(me.vihara_ids).not.toContain(codes.VVG);

      // VVG — vihara yang TIDAK ditugaskan — harus tertutup.
      expect((await apiCall(token, `/api/penerimaan?vihara_id=${codes.VVG}`)).status).toBe(403);
      expect((await apiCall(token, `/api/viharas/${codes.VVG}`)).status).toBe(403);

      // Di UI pun hanya dua vihara itu yang bisa dipilih.
      await page.goto("/login");
      await page.evaluate(() => window.localStorage.clear());
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("password123");
      await page.getByRole("button", { name: "Masuk" }).click();
      await page.waitForURL("**/dashboard");

      const selector = page.getByTestId("vihara-selector");
      await expect
        .poll(async () => await selector.locator("option").count(), { timeout: 10_000 })
        .toBe(3); // Semua Vihara + 2
      const labels = await selector.locator("option").allTextContents();
      expect(labels.some((l) => l.includes("Vipassan"))).toBe(false); // VVG absen
    } finally {
      // Jangan tinggalkan user uji — spec lain berbagi database yang sama.
      await apiCall(admin, `/api/admin/users/${dibuat.body.id}`, { method: "DELETE" });
    }
  });
});
