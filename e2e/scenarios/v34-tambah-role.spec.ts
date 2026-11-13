/**
 * v34 — Superadmin membuat role baru.
 *
 * Yang diuji:
 *   1. Superadmin melihat tombol "+ Role baru"; admin_yayasan TIDAK — baik
 *      tombol buat maupun tombol edit permission, walau ia tetap boleh
 *      MEMBACA katalog role (dibutuhkan form "User baru").
 *   2. Validasi nama di klien: karakter ilegal dan nama duplikat menahan
 *      tombol simpan sebelum request terkirim.
 *   3. Role yang dibuat benar-benar tersimpan (muncul di kartu + di dropdown
 *      role pada form Users) dengan permission yang dicentang.
 *   4. Penegakan di API, bukan hanya UI: admin_yayasan POST /admin/roles → 403.
 *   5. Hapus role: hanya role buatan sendiri yang belum dipakai. Role bawaan,
 *      superadmin, dan role yang masih dipunyai pengguna ditolak server.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login } from "../fixtures/auth";

type RoleRow = {
  id: number;
  name: string;
  users_count: number;
  permissions: string[];
  is_builtin: boolean;
  is_protected: boolean;
  can_delete: boolean;
};

// Nama role dibatasi /^[a-z0-9_]+$/ oleh API, jadi uniq() biasa tidak dipakai.
function uniqRoleName(): string {
  return `e2e_role_${Date.now().toString().slice(-9)}`;
}

test.describe("v34 tambah role", () => {
  test("admin_teratas: boleh baca katalog, tidak boleh mengubah", async ({ page }) => {
    // Membaca katalog role butuh users.manage ATAU roles.manage. Sejak
    // matriks penguji dipakai, admin_yayasan tidak lagi memegang keduanya;
    // admin_teratas memegang users.manage saja — persis peran yang diuji di
    // sini: boleh membaca, tidak boleh mengubah definisi role.
    await login(page, "adminTeratas");

    // Menu Roles disembunyikan (butuh roles.manage).
    const nav = page.locator("nav").first();
    await expect(nav.getByText("Roles", { exact: true })).toHaveCount(0);

    // Akses langsung lewat URL tetap boleh membaca, tapi tanpa tombol ubah.
    await page.goto("/admin/roles");
    await expect(page.getByTestId("role-name-bendahara")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("role-baru")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit permissions" })).toHaveCount(0);

    // Penegakan sebenarnya ada di API, bukan di UI.
    const token = await apiToken("adminTeratas");
    const res = await apiCall(token, "/api/admin/roles", {
      method: "POST",
      body: JSON.stringify({ name: "role_selundupan", permissions: [] }),
    });
    expect(res.status).toBe(403);
  });

  test("superadmin: validasi nama menahan simpan", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/roles");

    await page.getByTestId("role-baru").click();
    const name = page.getByTestId("role-name-input");
    const simpan = page.getByTestId("role-simpan");

    // Kosong → tertahan.
    await expect(simpan).toBeDisabled();

    // Karakter ilegal → tertahan + alasan tampil.
    await name.fill("Koordinator Vihara!");
    await expect(page.getByText("Hanya huruf kecil, angka, dan underscore.")).toBeVisible();
    await expect(simpan).toBeDisabled();

    // Nama yang sudah dipakai → tertahan.
    await name.fill("bendahara");
    await expect(page.getByText("Nama role ini sudah dipakai.")).toBeVisible();
    await expect(simpan).toBeDisabled();

    // Nama sah → boleh simpan.
    await name.fill(uniqRoleName());
    await expect(simpan).toBeEnabled();
  });

  test("superadmin: role baru tersimpan dan langsung bisa dipakai", async ({ page }) => {
    const roleName = uniqRoleName();
    const perms = ["penerimaan.view", "penerimaan.create", "cash.view"];

    await login(page, "admin");
    await page.goto("/admin/roles");

    await page.getByTestId("role-baru").click();
    await page.getByTestId("role-name-input").fill(roleName);
    for (const p of perms) {
      await page.getByTestId(`perm-${p}`).check();
    }
    await page.getByTestId("role-simpan").click();

    // Dialog tertutup dan kartu role baru muncul dengan permissionnya.
    await expect(page.getByTestId("role-name-input")).toHaveCount(0);
    const kartu = page.getByTestId(`role-name-${roleName}`);
    await expect(kartu).toBeVisible({ timeout: 10_000 });
    const card = page.getByTestId(`role-card-${roleName}`);
    for (const p of perms) {
      await expect(card.getByText(p, { exact: true }).first()).toBeVisible();
    }

    // Benar-benar ada di API, bukan cuma di state React.
    const token = await apiToken("admin");
    const res = await apiCall<RoleRow[]>(token, "/api/admin/roles");
    expect(res.status).toBe(200);
    const dari_api = res.body.find((r) => r.name === roleName);
    expect(dari_api).toBeTruthy();
    expect(dari_api!.permissions.sort()).toEqual([...perms].sort());

    // Dan langsung bisa dipilih saat membuat pengguna.
    await page.goto("/admin/users");
    await expect(page.getByRole("button", { name: /baru|tambah/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /baru|tambah/i }).first().click();
    await expect(
      page.locator("select").filter({ hasText: "bendahara" }).first().locator(`option[value="${roleName}"]`),
    ).toHaveCount(1);

    // Bersihkan sendiri — suite tidak boleh menumpuk role tiap kali jalan.
    expect(
      (await apiCall(token, `/api/admin/roles/${dari_api!.id}`, { method: "DELETE" })).status,
    ).toBe(200);
  });

  test("hapus role: hanya role buatan sendiri yang belum dipakai", async () => {
    const token = await apiToken("admin");
    const roleName = uniqRoleName();

    // Role buatan sendiri, belum dipakai → boleh dihapus.
    const dibuat = await apiCall<{ id: number }>(token, "/api/admin/roles", {
      method: "POST",
      body: JSON.stringify({ name: roleName, permissions: ["cash.view"] }),
    });
    expect(dibuat.status).toBe(201);
    const id = dibuat.body.id;

    const katalog = await apiCall<RoleRow[]>(token, "/api/admin/roles");
    const baru = katalog.body.find((r) => r.name === roleName)!;
    expect(baru.is_builtin).toBe(false);
    expect(baru.can_delete).toBe(true);

    // Role bawaan ditolak walau tak seorang pun memakainya.
    const bawaan = katalog.body.find((r) => r.is_builtin && r.name !== "superadmin")!;
    expect(bawaan.can_delete).toBe(false);
    const tolakBawaan = await apiCall<{ message: string }>(
      token,
      `/api/admin/roles/${bawaan.id}`,
      { method: "DELETE" },
    );
    expect(tolakBawaan.status).toBe(422);
    expect(tolakBawaan.body.message).toContain("bawaan");

    // superadmin ditolak terpisah — jangan sampai sistem kehilangan kuncinya.
    const sa = katalog.body.find((r) => r.name === "superadmin")!;
    const tolakSa = await apiCall<{ message: string }>(token, `/api/admin/roles/${sa.id}`, {
      method: "DELETE",
    });
    expect(tolakSa.status).toBe(422);

    // admin_yayasan tidak boleh menghapus apa pun.
    const tokenYayasan = await apiToken("adminYayasan");
    const tolak403 = await apiCall(tokenYayasan, `/api/admin/roles/${id}`, { method: "DELETE" });
    expect(tolak403.status).toBe(403);

    // Begitu dipakai pengguna, role terkunci dari penghapusan.
    const email = `${roleName}@vihara.test`;
    const user = await apiCall<{ id: number }>(token, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Uji Hapus Role",
        email,
        password: "password123",
        role: roleName,
        scope_type: "vihara",
        entity_id: 1,
        vihara_ids: [1],
      }),
    });
    expect(user.status).toBe(201);

    const tolakDipakai = await apiCall<{ message: string }>(token, `/api/admin/roles/${id}`, {
      method: "DELETE",
    });
    expect(tolakDipakai.status).toBe(422);
    expect(tolakDipakai.body.message).toContain("masih dipakai");

    // Setelah penggunanya pergi, role boleh dihapus — dan benar-benar hilang.
    expect(
      (await apiCall(token, `/api/admin/users/${user.body.id}`, { method: "DELETE" })).status,
    ).toBe(200);
    expect((await apiCall(token, `/api/admin/roles/${id}`, { method: "DELETE" })).status).toBe(200);

    const sesudah = await apiCall<RoleRow[]>(token, "/api/admin/roles");
    expect(sesudah.body.some((r) => r.name === roleName)).toBe(false);
  });

  test("UI: tombol hapus hanya untuk role buatan sendiri yang bebas", async ({ page }) => {
    const token = await apiToken("admin");
    const roleName = uniqRoleName();
    await apiCall(token, "/api/admin/roles", {
      method: "POST",
      body: JSON.stringify({ name: roleName, permissions: ["cash.view"] }),
    });

    await login(page, "admin");
    await page.goto("/admin/roles");

    // Role bawaan: tidak ada tombol hapus sama sekali.
    await expect(page.getByTestId("role-name-bendahara")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("role-hapus-bendahara")).toHaveCount(0);
    await expect(page.getByTestId("role-hapus-superadmin")).toHaveCount(0);

    // Role buatan sendiri: tombol hapus aktif, dan benar-benar menghapus.
    const tombol = page.getByTestId(`role-hapus-${roleName}`);
    await expect(tombol).toBeEnabled();
    page.once("dialog", (d) => d.accept());
    await tombol.click();
    await expect(page.getByTestId(`role-card-${roleName}`)).toHaveCount(0, { timeout: 10_000 });

    // Hilang di server juga, bukan cuma di layar.
    const sesudah = await apiCall<RoleRow[]>(token, "/api/admin/roles");
    expect(sesudah.body.some((r) => r.name === roleName)).toBe(false);
  });
});
