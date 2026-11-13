/**
 * v37 — Pesan validasi terbaca (FV-9).
 *
 * APP_LOCALE=id sejak awal, tapi folder lang/ tidak pernah ada di repo API.
 * Akibatnya SELURUH pesan validasi Laravel keluar sebagai kunci terjemahan —
 * pengguna melihat "validation.gt.numeric" dan tidak tahu field mana yang
 * salah. Yang diuji di sini: tidak ada lagi teks berawalan `validation.`
 * yang sampai ke pengguna, pesannya menyebut nama field yang dikenal, dan
 * bila beberapa field salah semuanya ikut tampil.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";

type Galat = { message: string; errors?: Record<string, string[]> };

test.describe("v37 pesan validasi", () => {
  let token = "";
  let viharaVvg = 0;

  test.beforeAll(async () => {
    token = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
  });

  test("kasus yang dilaporkan: Jumlah kosong di Input Penerimaan", async () => {
    const res = await apiCall<Galat>(token, "/api/penerimaan", {
      method: "POST",
      body: JSON.stringify({
        date: new Date().toLocaleDateString("en-CA"),
        method: "tunai",
        category: "dana_perayaan",
        name: "Dana Kathina",
        vihara_id: viharaVvg,
        amount: 0,
      }),
    });
    expect(res.status).toBe(422);
    expect(res.body.message).not.toContain("validation.");
    // Menyebut field dan aturannya, bukan nama kolom atau kode internal.
    expect(res.body.message).toContain("Jumlah");
    expect(res.body.errors?.amount?.[0]).toMatch(/lebih dari/i);
  });

  test("beberapa field salah: semuanya tampil, bukan hanya yang pertama", async () => {
    const res = await apiCall<Galat>(token, "/api/penerimaan", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);

    const pesan = Object.values(res.body.errors ?? {}).flat();
    expect(pesan.length).toBeGreaterThan(1);
    for (const p of pesan) expect(p).not.toContain("validation.");

    // Nama field diterjemahkan, bukan nama kolom mentah.
    expect(res.body.errors?.date?.[0]).toContain("Tanggal");
    expect(res.body.errors?.category?.[0]).toContain("Kategori");
  });

  test("tidak ada kunci mentah di form lain yang juga memvalidasi", async () => {
    for (const path of ["/api/pembayaran", "/api/viharas", "/api/admin/roles"]) {
      const res = await apiCall<Galat>(token, path, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(res.status, `${path} harusnya menolak`).toBe(422);
      const semua = [res.body.message, ...Object.values(res.body.errors ?? {}).flat()];
      for (const p of semua) {
        expect(p, `${path}: pesan masih kunci mentah`).not.toContain("validation.");
      }
    }
  });

  test("UI menahan Ajukan/Submit selagi Jumlah masih kosong", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/penerimaan");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));
    await selectByLabelRegex(page.getByLabel("Kategori Dana *"), /Dana Perayaan/);
    await selectByLabelRegex(page.getByLabel("Nama Penerimaan *"), /Dana Kathina/);

    // Simpan sebagai Draft tetap boleh — draft memang boleh setengah jadi.
    const simpan = page.getByTestId("tombol-submit");
    await expect(simpan).toBeDisabled();
    await expect(page.getByTestId("tombol-ajukan")).toBeDisabled();
    await expect(page.getByTestId("tombol-draft")).toBeEnabled();
    await expect(page.getByText("Isi jumlah dulu")).toBeVisible();

    await page.getByLabel("Jumlah (Rp) *").fill("50000");
    await expect(simpan).toBeEnabled();
    await expect(page.getByTestId("tombol-ajukan")).toBeEnabled();
    await expect(page.getByText("Isi jumlah dulu")).toHaveCount(0);
  });
});
