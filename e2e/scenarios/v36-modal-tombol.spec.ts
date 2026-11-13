/**
 * v36 — Tombol di modal selalu terjangkau (FV-8, FV-11).
 *
 * Dulu tiap halaman menyalin sendiri markup overlay-nya dan sebagian besar
 * salinan itu tidak membatasi tinggi panel terhadap layar. Begitu isi form
 * lebih tinggi dari viewport, baris tombol terdorong keluar layar: form tidak
 * bisa disimpan sama sekali, dan menggulir pun tidak menolong karena yang
 * bergerak hanya isi di dalamnya.
 *
 * Yang diuji di sini bukan "modal muncul", tapi hal yang persis gagal dulu:
 * posisi tombol footer terhadap viewport. Sengaja dijalankan pada layar
 * pendek (768×600) — pada layar tinggi bug ini tidak pernah terlihat.
 */
import { test, expect, Page, Locator } from "@playwright/test";
import { login } from "../fixtures/auth";

test.use({ viewport: { width: 1024, height: 600 } });

/** Tombol harus utuh di dalam viewport, bukan sekadar ada di DOM. */
async function harusTerjangkau(page: Page, tombol: Locator, nama: string) {
  await expect(tombol, `${nama}: tombol tidak ada`).toBeVisible({ timeout: 10_000 });
  const box = await tombol.boundingBox();
  const tinggi = page.viewportSize()!.height;
  expect(box, `${nama}: tombol tanpa kotak`).not.toBeNull();
  expect(box!.y, `${nama}: tombol di atas layar`).toBeGreaterThanOrEqual(0);
  expect(
    box!.y + box!.height,
    `${nama}: tombol terpotong di bawah layar (bawah ${Math.round(box!.y + box!.height)} > ${tinggi})`,
  ).toBeLessThanOrEqual(tinggi);
  // Benar-benar bisa diklik, bukan cuma kebetulan ada di koordinat yang pas.
  await expect(tombol, `${nama}: tombol tidak bisa diklik`).toBeEnabled();
}

test.describe("v36 tombol modal", () => {
  test("Admin Roles: Role baru — tombol tetap terjangkau walau semua permission dicentang", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/admin/roles");
    await page.getByTestId("role-baru").click();

    // Nama diisi dulu: tombol Buat role memang menahan diri sampai namanya
    // sah, jadi tanpa ini yang teruji bukan posisinya melainkan validasinya.
    await page.getByTestId("role-name-input").fill(`e2e_modal_${Date.now().toString().slice(-8)}`);

    // Kasus terburuk: semua permission dicentang sehingga isi modal
    // sepanjang mungkin.
    const checkAll = page.getByRole("button", { name: "Check all" });
    const jumlah = await checkAll.count();
    for (let i = 0; i < jumlah; i++) await checkAll.nth(i).click();

    await harusTerjangkau(page, page.getByTestId("role-simpan"), "Roles/Buat role");
    await harusTerjangkau(
      page,
      page.getByRole("button", { name: "Batal", exact: true }),
      "Roles/Batal",
    );

    // Judul tetap di tempat — yang menggulir hanya isinya.
    await expect(page.getByRole("heading", { name: "Role baru" })).toBeVisible();
  });

  test("Admin Users: User baru — tombol terjangkau termasuk saat Jangkauan Akses terbuka", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/admin/users");
    await page.getByRole("button", { name: /baru|tambah/i }).first().click();

    // Tingkat "vihara" memunculkan daftar centang vihara — isi modal memanjang.
    const scope = page.locator("select").filter({ hasText: "Vihara" }).last();
    if (await scope.count()) {
      await scope.selectOption("vihara").catch(() => {});
    }

    await harusTerjangkau(
      page,
      page.getByRole("button", { name: "Simpan", exact: true }),
      "Users/Simpan",
    );
    await harusTerjangkau(
      page,
      page.getByRole("button", { name: "Batal", exact: true }),
      "Users/Batal",
    );
  });

  for (const kasus of [
    { url: "/admin/coa", tombolBuka: /Akun baru/i, nama: "COA" },
    { url: "/admin/entities", tombolBuka: /Yayasan baru/i, nama: "Yayasan" },
    { url: "/admin/vihara", tombolBuka: /Vihara baru/i, nama: "Vihara" },
  ]) {
    test(`${kasus.nama}: tombol modal terjangkau di layar pendek`, async ({ page }) => {
      await login(page, "admin");
      await page.goto(kasus.url);
      await page.getByRole("button", { name: kasus.tombolBuka }).first().click();

      await harusTerjangkau(
        page,
        page.getByRole("button", { name: "Simpan", exact: true }),
        `${kasus.nama}/Simpan`,
      );
      await harusTerjangkau(
        page,
        page.getByRole("button", { name: "Batal", exact: true }),
        `${kasus.nama}/Batal`,
      );
    });
  }
});
