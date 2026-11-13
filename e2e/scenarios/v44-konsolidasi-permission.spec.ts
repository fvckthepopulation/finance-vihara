/**
 * v44 — Permission menu Konsolidasi Yayasan (FV-32).
 *
 * Konsolidasi menumpang izin reports.pl.view, jadi tidak ada yang bisa
 * dicentang per role: siapa pun yang boleh melihat laporan per vihara ikut
 * memegang gabungan seluruh vihara. Sekarang izinnya sendiri
 * (konsolidasi.view), dan jangkauan tingkat yayasan tetap jadi syarat kedua:
 * user berjangkauan Vihara tidak bisa melihatnya walau izinnya dicentang.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login } from "../fixtures/auth";

test.describe.configure({ mode: "serial" });

const PERIODE = "?mode=ytd&year=2026";

test.describe("v44 permission konsolidasi", () => {
  test("FV-32: konsolidasi.view ada di permission matrix", async () => {
    const token = await apiToken("admin");
    const { body } = await apiCall<{ catalog: string[]; hidden?: string[] }>(
      token,
      "/api/admin/permissions",
    );
    expect(body.catalog).toContain("konsolidasi.view");
    expect(body.hidden ?? []).not.toContain("konsolidasi.view");
  });

  test("FV-32: role tingkat yayasan dapat izinnya, bendahara tidak", async () => {
    for (const u of ["admin", "adminYayasan", "pengawas"] as const) {
      const token = await apiToken(u);
      expect(
        (await apiCall(token, `/api/laporan/konsolidasi${PERIODE}`)).status,
        `${u} boleh membuka konsolidasi`,
      ).toBe(200);
    }
    const bendahara = await apiToken("bendahara");
    expect((await apiCall(bendahara, `/api/laporan/konsolidasi${PERIODE}`)).status).toBe(403);
  });

  test("FV-32: menu hanya muncul untuk pemegang izin", async ({ page }) => {
    await login(page, "adminYayasan");
    await expect(page.getByRole("link", { name: "Konsolidasi Yayasan" }).first()).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "Keluar" }).click();
    await page.waitForURL("**/login");

    await login(page, "bendahara");
    await expect(page.locator('a[href="/konsolidasi"]')).toHaveCount(0);
  });

  test("FV-32: jangkauan Vihara tetap ditolak walau izinnya dicentang", async () => {
    const admin = await apiToken("admin");
    const roles = await apiCall<Array<{ id: number; name: string; permissions: string[] }>>(
      admin,
      "/api/admin/roles",
    );
    const bendahara = roles.body.find((r) => r.name === "bendahara");
    expect(bendahara, "role bendahara harus ada").toBeTruthy();
    const semula = bendahara!.permissions;

    await apiCall(admin, `/api/admin/roles/${bendahara!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ permissions: [...semula, "konsolidasi.view"] }),
    });
    try {
      const token = await apiToken("bendahara");
      const res = await apiCall<{ message?: string }>(
        token,
        `/api/laporan/konsolidasi${PERIODE}`,
      );
      // Izinnya ada, tapi jangkauannya vihara → tetap ditolak, dan alasannya
      // disebut: ini soal jangkauan, bukan soal izin.
      expect(res.status).toBe(403);
      expect(res.body.message ?? "").toMatch(/tingkat yayasan/i);
    } finally {
      await apiCall(admin, `/api/admin/roles/${bendahara!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: semula }),
      });
    }
  });

  test("FV-32: isi konsolidasi terbatas vihara dalam jangkauan user", async () => {
    type Entry = { vihara?: { code: string } };
    const admin = await apiCall<{ per_vihara: Entry[] }>(
      await apiToken("admin"),
      `/api/laporan/konsolidasi${PERIODE}`,
    );
    const yayasan = await apiCall<{ per_vihara: Entry[] }>(
      await apiToken("adminYayasan"),
      `/api/laporan/konsolidasi${PERIODE}`,
    );

    const kodeAdmin = admin.body.per_vihara.map((e) => e.vihara?.code).filter(Boolean);
    const kodeYayasan = yayasan.body.per_vihara.map((e) => e.vihara?.code).filter(Boolean);
    expect(kodeAdmin.length).toBeGreaterThan(0);
    expect(kodeYayasan.length).toBeGreaterThan(0);
    // Admin yayasan YDI tidak boleh melihat vihara di luar yayasannya.
    expect(kodeYayasan.length).toBeLessThanOrEqual(kodeAdmin.length);
    for (const k of kodeYayasan) expect(kodeAdmin).toContain(k);
  });
});
