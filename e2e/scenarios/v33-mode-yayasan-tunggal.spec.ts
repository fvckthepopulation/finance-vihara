/**
 * v33 — Mode yayasan tunggal (SINGLE_ENTITY_MODE).
 *
 * Instance yang hanya melayani SATU yayasan tanpa cabang vihara menyalakan
 * `SINGLE_ENTITY_MODE=true` di .env API. Itu murni penyesuaian tampilan —
 * API tetap menegakkan hirarki yang sama persis.
 *
 * Spec ini membaca mode yang sedang aktif dari /api/me lalu memastikan UI
 * KONSISTEN dengan mode itu, sehingga suite yang sama sahih dijalankan di
 * kedua konfigurasi:
 *
 *   SINGLE_ENTITY_MODE=false  (default) -> pemilih vihara & Konsolidasi ada
 *   SINGLE_ENTITY_MODE=true             -> keduanya disembunyikan
 *
 * Untuk menguji jalur yang satunya: ubah SINGLE_ENTITY_MODE di .env repo
 * API menjadi true, lalu jalankan ulang spec ini.
 */
import { test, expect } from "@playwright/test";
import { apiMe, apiToken, login } from "../fixtures/auth";

test.describe("v33 mode yayasan tunggal", () => {
  test("API melaporkan mode yang sedang aktif", async () => {
    const me = await apiMe(await apiToken("admin"));
    expect(typeof me.app.single_entity_mode).toBe("boolean");
  });

  test("UI konsisten dengan mode yang sedang aktif", async ({ page }) => {
    const me = await apiMe(await apiToken("pengawas")); // scope yayasan
    const tunggal = me.app.single_entity_mode;

    await login(page, "pengawas");

    const selector = page.getByTestId("vihara-selector");
    const konsolidasi = page.getByRole("link", { name: "Konsolidasi Yayasan" });

    if (tunggal) {
      // Yayasan tunggal: konsep multi-vihara tidak relevan.
      await expect(selector).toHaveCount(0);
      await expect(konsolidasi).toHaveCount(0);
    } else {
      await expect(selector).toBeVisible();
      await expect(konsolidasi).toBeVisible();
    }
  });

  test("mode tampilan TIDAK melonggarkan penegakan di API", async () => {
    // Apa pun modenya, pemegang scope vihara tetap tidak boleh menembus
    // batas viharanya. Mode hanya menyembunyikan menu, bukan membuka data.
    const me = await apiMe(await apiToken("bendahara"));
    expect(me.scope_type).toBe("vihara");
    expect(me.can_see_yayasan_level).toBe(false);
    expect(me.vihara_ids).toHaveLength(1);
  });
});
