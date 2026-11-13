/**
 * C-ADM — Admin & Master, skenario ENV-C dari penguji.
 *
 * Sumber: "Test scenario Finance Vihara.xlsx" (v2.1) sheet Detail ENV-C, dan
 * "User_Role_Permission_ENV-C_v2.xlsx" sheet Permission.
 *
 * Nama tiap tes memakai ID skenario pengujinya, supaya hasil di sini bisa
 * langsung disalin ke kolom Status di sheet mereka.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login } from "../fixtures/auth";
import { uniq } from "../fixtures/uniq";

type Dibuat = { id: number };

test.describe.configure({ mode: "serial" });

/**
 * Izin per role, disalin dari sheet Permission (kolom ✓/✗).
 * Angka di belakang = "Jumlah key ✓" di baris terakhir sheet itu.
 */
const IZIN_SHEET: Record<string, { jumlah: number; keys: string[] }> = {
  admin_teratas: {
    jumlah: 33,
    keys: [
      "cash.view", "cash.account.manage",
      "reconcile.view", "reconcile.import", "reconcile.match", "reconcile.finalize",
      "petty_cash.view", "petty_cash.declare", "petty_cash.approve", "petty_cash.replenish",
      "pembayaran.view", "pembayaran.create", "pembayaran.approve",
      "penerimaan.view", "penerimaan.create", "penerimaan.approve",
      "reports.pl.view", "reports.balance_sheet.view", "reports.export",
      "anggaran.view", "anggaran.manage",
      "tax.view", "tax.compliance.manage",
      "journal.view", "journal.create", "journal.approve",
      "period.view", "period.close",
      "entities.view",
      "users.manage",
      "coa.view",
      "masters.view", "masters.manage",
    ],
  },
  admin_konsolidasi: {
    jumlah: 16,
    keys: [
      "cash.view",
      "reconcile.view", "reconcile.import", "reconcile.match", "reconcile.finalize",
      "petty_cash.view",
      "pembayaran.view",
      "penerimaan.view",
      "reports.pl.view", "reports.balance_sheet.view", "reports.export",
      "anggaran.view",
      "tax.view",
      "journal.view",
      "period.view",
      "coa.view",
    ],
  },
  admin_yayasan: {
    jumlah: 26,
    keys: [
      "cash.view",
      "reconcile.view", "reconcile.import", "reconcile.match", "reconcile.finalize",
      "petty_cash.view", "petty_cash.declare", "petty_cash.approve", "petty_cash.replenish",
      "pembayaran.view", "pembayaran.create", "pembayaran.approve",
      "penerimaan.view", "penerimaan.create", "penerimaan.approve",
      "reports.pl.view", "reports.balance_sheet.view", "reports.export",
      "anggaran.view", "anggaran.manage",
      "tax.view", "tax.compliance.manage",
      "journal.view", "journal.create",
      "period.view",
      "coa.view",
    ],
  },
  admin_vihara: {
    jumlah: 13,
    keys: [
      "cash.view",
      "petty_cash.view", "petty_cash.declare", "petty_cash.replenish",
      "pembayaran.view", "pembayaran.create",
      "penerimaan.view", "penerimaan.create",
      "reports.pl.view", "reports.balance_sheet.view", "reports.export",
      "anggaran.view",
      "coa.view",
    ],
  },
};

/**
 * Key yang ADA di sistem ini tapi tidak ada di 37 key sheet. Dua di antaranya
 * justru menutup temuan penguji: *.void menjawab T-01 ("tidak ada key
 * delete/void") dan konsolidasi.view menjawab T-03 ("Konsolidasi tidak punya
 * key"). Dikecualikan saat membandingkan jumlah, bukan diabaikan diam-diam.
 */
const KEY_DI_LUAR_SHEET = [
  "transaksi.view",
  "konsolidasi.view",
  "pembayaran.void",
  "penerimaan.void",
  "journal.void",
  "petty_cash.void",
];

test.describe("ENV-C · Admin & Master", () => {
  let admin = "";

  test.beforeAll(async () => {
    admin = await apiToken("admin");
  });

  test("C-ADM-03: lima role tersedia dengan permission sesuai sheet", async () => {
    const res = await apiCall<Array<{ id: number; name: string; permissions: string[] }>>(
      admin,
      "/api/admin/roles",
    );
    const roles = Object.fromEntries(res.body.map((r) => [r.name, r.permissions]));

    expect(roles["superadmin"], "Super Admin harus ada").toBeTruthy();

    for (const [nama, { jumlah, keys }] of Object.entries(IZIN_SHEET)) {
      const punya = roles[nama];
      expect(punya, `role ${nama} harus ada`).toBeTruthy();

      const kurang = keys.filter((k) => !punya.includes(k));
      expect(kurang, `${nama} kehilangan izin dari sheet`).toEqual([]);

      const lebih = punya.filter((k) => !keys.includes(k) && !KEY_DI_LUAR_SHEET.includes(k));
      expect(lebih, `${nama} punya izin yang tidak ada di sheet`).toEqual([]);

      const sesuaiSheet = punya.filter((k) => !KEY_DI_LUAR_SHEET.includes(k));
      expect(sesuaiSheet.length, `jumlah key ✓ ${nama}`).toBe(jumlah);
    }
  });

  test("C-ADM-03: perubahan permission role tersimpan setelah dimuat ulang", async () => {
    const res = await apiCall<Array<{ id: number; name: string; permissions: string[] }>>(
      admin,
      "/api/admin/roles",
    );
    const role = res.body.find((r) => r.name === "admin_vihara")!;
    const semula = role.permissions;

    await apiCall(admin, `/api/admin/roles/${role.id}`, {
      method: "PATCH",
      body: JSON.stringify({ permissions: [...semula, "anggaran.manage"] }),
    });
    try {
      const lagi = await apiCall<Array<{ name: string; permissions: string[] }>>(
        admin,
        "/api/admin/roles",
      );
      expect(lagi.body.find((r) => r.name === "admin_vihara")!.permissions).toContain(
        "anggaran.manage",
      );
    } finally {
      await apiCall(admin, `/api/admin/roles/${role.id}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: semula }),
      });
    }
  });

  test("C-ADM-04: user wajib tersimpan dengan role, yayasan, dan vihara", async () => {
    const email = `admin.vp.${Date.now().toString().slice(-6)}@uji.test`;
    const vihara = await apiCall<{ data: Array<{ id: number; code: string }> }>(
      admin,
      "/api/viharas",
    );
    const vvg = vihara.body.data.find((v) => v.code === "VVG")!;

    const dibuat = await apiCall<Dibuat & { active: boolean; scope_type: string }>(
      admin,
      "/api/admin/users",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Admin Vihara Uji",
          email,
          password: "password123",
          role: "admin_vihara",
          entity_id: 1,
          scope_type: "vihara",
          vihara_ids: [vvg.id],
        }),
      },
    );
    expect(dibuat.status).toBe(201);
    expect(dibuat.body.scope_type).toBe("vihara");
    expect(dibuat.body.active).toBe(true);

    try {
      // Tanpa role ditolak.
      const tanpaRole = await apiCall(admin, "/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: "Tanpa Role",
          email: `tanpa.role.${Date.now()}@uji.test`,
          password: "password123",
          entity_id: 1,
          scope_type: "vihara",
          vihara_ids: [vvg.id],
        }),
      });
      expect(tanpaRole.status).toBe(422);

      // Jangkauan vihara tanpa vihara ditolak.
      const tanpaVihara = await apiCall(admin, "/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: "Tanpa Vihara",
          email: `tanpa.vihara.${Date.now()}@uji.test`,
          password: "password123",
          role: "admin_vihara",
          entity_id: 1,
          scope_type: "vihara",
          vihara_ids: [],
        }),
      });
      expect(tanpaVihara.status).toBe(422);

      // Email kembar ditolak.
      const kembar = await apiCall(admin, "/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: "Kembar",
          email,
          password: "password123",
          role: "admin_vihara",
          entity_id: 1,
          scope_type: "vihara",
          vihara_ids: [vvg.id],
        }),
      });
      expect(kembar.status).toBe(422);
    } finally {
      await apiCall(admin, `/api/admin/users/${dibuat.body.id}`, { method: "DELETE" });
    }
  });

  test("C-ADM-05: user nonaktif tidak bisa login, dan sesinya putus saat dinonaktifkan", async ({
    page,
  }) => {
    const email = `uji.nonaktif.${Date.now().toString().slice(-6)}@uji.test`;
    const vihara = await apiCall<{ data: Array<{ id: number; code: string }> }>(
      admin,
      "/api/viharas",
    );
    const vvg = vihara.body.data.find((v) => v.code === "VVG")!;

    const user = await apiCall<Dibuat>(admin, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Uji Nonaktif",
        email,
        password: "password123",
        role: "admin_vihara",
        entity_id: 1,
        scope_type: "vihara",
        vihara_ids: [vvg.id],
        active: false,
      }),
    });
    expect(user.status).toBe(201);

    try {
      // 1. Login ditolak, dengan alasannya disebut — bukan "email atau
      //    password salah" yang membuat orang mencoba berkali-kali.
      const gagal = await apiCall<{ message: string }>(
        "",
        "/api/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password: "password123" }),
          headers: { "Content-Type": "application/json" },
        },
      );
      expect(gagal.status).toBe(422);
      expect(gagal.body.message).toMatch(/nonaktif/i);

      // Di layar login pun pesannya terbaca.
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("password123");
      await page.getByRole("button", { name: "Masuk" }).click();
      await expect(page.getByText(/nonaktif/i)).toBeVisible({ timeout: 15_000 });

      // 2. Diaktifkan → bisa masuk.
      await apiCall(admin, `/api/admin/users/${user.body.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: true }),
      });
      const token = await apiToken({ email, password: "password123" });
      expect((await apiCall(token, "/api/me")).status).toBe(200);

      // 3. Dinonaktifkan saat masih login → permintaan berikutnya ditolak.
      await apiCall(admin, `/api/admin/users/${user.body.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      });
      const sesudah = await apiCall(token, "/api/me");
      expect([401, 403]).toContain(sesudah.status);
    } finally {
      await apiCall(admin, `/api/admin/users/${user.body.id}`, { method: "DELETE" });
    }
  });

  test("P-01: tiap yayasan punya unit Umum/Pusat yang tidak bisa dihapus", async () => {
    const res = await apiCall<{ data: Array<{ id: number; name: string; is_umum?: boolean }> }>(
      admin,
      "/api/viharas?per_page=100",
    );
    const umum = res.body.data.filter((v) => v.is_umum);
    expect(umum.length, "minimal satu unit Umum").toBeGreaterThan(0);
    expect(umum[0].name).toMatch(/Umum\/Pusat/);

    const hapus = await apiCall<{ message: string }>(admin, `/api/viharas/${umum[0].id}`, {
      method: "DELETE",
    });
    expect(hapus.status).toBe(422);
    expect(hapus.body.message).toMatch(/tidak bisa dihapus/i);
  });

  test("P-01: yayasan baru langsung punya unit Umum", async () => {
    const stamp = Date.now().toString().slice(-5);
    const yayasan = await apiCall<Dibuat>(admin, "/api/entities", {
      method: "POST",
      body: JSON.stringify({
        code: `UMM${stamp}`,
        legal_name: `Yayasan Unit ${stamp}`,
        address: "Semarang",
      }),
    });
    expect(yayasan.status).toBe(201);

    try {
      const viharas = await apiCall<{ data: Array<{ entity_id: number; is_umum?: boolean }> }>(
        admin,
        "/api/viharas?per_page=200",
      );
      const umum = viharas.body.data.filter(
        (v) => v.entity_id === yayasan.body.id && v.is_umum,
      );
      expect(umum.length, "yayasan baru dapat unit Umum otomatis").toBe(1);
    } finally {
      await apiCall(admin, `/api/entities/${yayasan.body.id}`, { method: "DELETE" });
    }
  });

  test("ENV-C: akun tiap role bisa masuk dan membawa jangkauannya", async () => {
    for (const [email, scope] of [
      ["admin.teratas@ydi.test", "global"],
      ["admin.konsolidasi@ydi.test", "global"],
      ["admin.vihara@vvg.test", "vihara"],
    ] as const) {
      const token = await apiToken({ email, password: "password" });
      const me = await apiCall<{ scope_type: string }>(token, "/api/me");
      expect(me.status, email).toBe(200);
      expect(me.body.scope_type, email).toBe(scope);
    }
  });
});
