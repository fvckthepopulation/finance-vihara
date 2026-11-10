/**
 * v99 — Isolasi antar YAYASAN dalam satu database.
 *
 * Satu instance menampung lebih dari satu yayasan. Yang diuji: admin sebuah
 * yayasan buta total terhadap yayasan lain — datanya, viharanya, bahkan
 * keberadaan yayasannya — dan tidak punya jalan menaikkan haknya sendiri.
 *
 * Sengaja berprefiks v99 agar dijalankan TERAKHIR: spec ini menambah
 * yayasan + vihara baru yang akan mengubah hitungan di spec lain. Semua
 * yang dibuat dibersihkan lagi di afterAll.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiMe, apiToken, viharaIdsByCode } from "../fixtures/auth";

type Dibuat = { id: number };
type Daftar<T> = { data: T[] };

const stamp = Date.now().toString().slice(-6);
const KODE_YAYASAN = `Y${stamp}`.slice(0, 8);
const EMAIL_ADMIN_BARU = `admin.yayasan2.${stamp}@uji.test`;
const PASSWORD_BARU = "password123";

let adminToken = "";
let yayasanBaruId = 0;
let viharaBaruId = 0;
let userBaruId = 0;
let viharaYdi: Record<string, number> = {};

test.describe.configure({ mode: "serial" });

test.describe("v99 multi-yayasan", () => {
  test.beforeAll(async () => {
    adminToken = await apiToken("admin");
    viharaYdi = await viharaIdsByCode();
  });

  test.afterAll(async () => {
    // Urutan penting: user dulu, lalu vihara, baru yayasan — API menolak
    // menghapus induk yang masih punya turunan.
    if (userBaruId) {
      await apiCall(adminToken, `/api/admin/users/${userBaruId}`, { method: "DELETE" });
    }
    if (viharaBaruId) {
      await apiCall(adminToken, `/api/viharas/${viharaBaruId}`, { method: "DELETE" });
    }
    if (yayasanBaruId) {
      await apiCall(adminToken, `/api/entities/${yayasanBaruId}`, { method: "DELETE" });
    }
  });

  test("admin tertinggi membuat yayasan kedua beserta viharanya", async () => {
    const yayasan = await apiCall<Dibuat>(adminToken, "/api/entities", {
      method: "POST",
      body: JSON.stringify({
        code: KODE_YAYASAN,
        legal_name: `Yayasan Uji ${stamp}`,
        address: "Semarang",
      }),
    });
    expect(yayasan.status).toBe(201);
    yayasanBaruId = yayasan.body.id;

    const vihara = await apiCall<Dibuat>(adminToken, "/api/viharas", {
      method: "POST",
      body: JSON.stringify({
        entity_id: yayasanBaruId,
        name: `Vihara Uji ${stamp}`,
        bank_name: "BNI",
        bank_account_number: `9999-${stamp}`,
        bank_account_holder: `Vihara Uji ${stamp}`,
      }),
    });
    expect(vihara.status).toBe(201);
    viharaBaruId = vihara.body.id;

    const user = await apiCall<Dibuat>(adminToken, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: `Admin Yayasan ${stamp}`,
        email: EMAIL_ADMIN_BARU,
        password: PASSWORD_BARU,
        role: "admin_yayasan",
        entity_id: yayasanBaruId,
        scope_type: "entity",
      }),
    });
    expect(user.status).toBe(201);
    userBaruId = user.body.id;
  });

  test("admin yayasan kedua hanya melihat yayasan & viharanya sendiri", async () => {
    const token = await apiToken({ email: EMAIL_ADMIN_BARU, password: PASSWORD_BARU });

    const me = await apiMe(token);
    expect(me.scope_type).toBe("entity");
    expect(me.entity_id).toBe(yayasanBaruId);
    expect(me.vihara_ids).toEqual([viharaBaruId]);

    const viharas = await apiCall<Daftar<{ id: number }>>(token, "/api/viharas");
    expect(viharas.body.data.map((v) => v.id)).toEqual([viharaBaruId]);

    const entities = await apiCall<Daftar<{ id: number }>>(token, "/api/entities");
    expect(entities.body.data.map((e) => e.id)).toEqual([yayasanBaruId]);
  });

  test("yayasan lain tertutup rapat — bukan sekadar tak tampil", async () => {
    const token = await apiToken({ email: EMAIL_ADMIN_BARU, password: PASSWORD_BARU });

    for (const path of [
      `/api/viharas/${viharaYdi.VVG}`,
      `/api/penerimaan?vihara_id=${viharaYdi.VVG}`,
      `/api/pembayaran?vihara_id=${viharaYdi.VBM}`,
      `/api/kas-bank?vihara_id=${viharaYdi.VVG}`,
      `/api/laporan/isak35?vihara_id=${viharaYdi.VVG}`,
      "/api/entities/1",
    ]) {
      const res = await apiCall(token, path);
      expect(res.status, `${path} harus 403`).toBe(403);
    }
  });

  test("angka yayasan kedua tidak tercampur yayasan pertama", async () => {
    const token = await apiToken({ email: EMAIL_ADMIN_BARU, password: PASSWORD_BARU });

    const dashboard = await apiCall<{ penerimaan: { total: number } }>(token, "/api/dashboard");
    expect(dashboard.status).toBe(200);
    // Yayasan baru belum punya transaksi sama sekali.
    expect(dashboard.body.penerimaan.total).toBe(0);

    // Sementara admin global melihat angka YDI yang jelas bukan nol.
    const global = await apiCall<{ penerimaan: { total: number } }>(adminToken, "/api/dashboard");
    expect(global.body.penerimaan.total).toBeGreaterThan(0);

    // Konsolidasi yayasan kedua hanya memuat viharanya sendiri.
    // (Entri "Kantor Yayasan" punya vihara.id null — bukan vihara, jadi
    // disaring dulu.)
    const konsol = await apiCall<{ per_vihara: { vihara: { id: number | null } }[] }>(
      token,
      "/api/laporan/konsolidasi",
    );
    expect(konsol.status).toBe(200);
    const idVihara = konsol.body.per_vihara
      .map((v) => v.vihara?.id)
      .filter((id): id is number => typeof id === "number");
    expect(idVihara).toEqual([viharaBaruId]);
  });

  test("admin yayasan tidak punya jalan menaikkan haknya sendiri", async () => {
    const token = await apiToken({ email: EMAIL_ADMIN_BARU, password: PASSWORD_BARU });

    // Membuat akun global.
    expect(
      (
        await apiCall(token, "/api/admin/users", {
          method: "POST",
          body: JSON.stringify({
            name: "Eskalasi",
            email: `eskalasi.${stamp}@uji.test`,
            password: PASSWORD_BARU,
            role: "superadmin",
            scope_type: "global",
          }),
        })
      ).status,
    ).toBe(403);

    // Membuat akun di yayasan orang lain.
    expect(
      (
        await apiCall(token, "/api/admin/users", {
          method: "POST",
          body: JSON.stringify({
            name: "Titipan",
            email: `titipan.${stamp}@uji.test`,
            password: PASSWORD_BARU,
            role: "bendahara",
            entity_id: 1,
            scope_type: "vihara",
            vihara_ids: [viharaYdi.VVG],
          }),
        })
      ).status,
    ).toBe(403);

    // Menugaskan vihara milik yayasan lain ke akunnya sendiri.
    expect(
      (
        await apiCall(token, "/api/admin/users", {
          method: "POST",
          body: JSON.stringify({
            name: "Nyerobot",
            email: `nyerobot.${stamp}@uji.test`,
            password: PASSWORD_BARU,
            role: "bendahara",
            scope_type: "vihara",
            vihara_ids: [viharaYdi.VVG],
          }),
        })
      ).status,
    ).toBe(403);

    // Menambah yayasan baru.
    expect(
      (
        await apiCall(token, "/api/entities", {
          method: "POST",
          body: JSON.stringify({ code: `Z${stamp}`.slice(0, 8), legal_name: "Yayasan Selundupan" }),
        })
      ).status,
    ).toBe(403);

    // Memindahkan viharanya ke yayasan lain.
    expect(
      (
        await apiCall(token, `/api/viharas/${viharaBaruId}`, {
          method: "PATCH",
          body: JSON.stringify({ entity_id: 1 }),
        })
      ).status,
    ).toBe(403);
  });

  test("admin tertinggi tetap melihat kedua yayasan", async () => {
    const entities = await apiCall<Daftar<{ id: number }>>(adminToken, "/api/entities");
    const ids = entities.body.data.map((e) => e.id);
    expect(ids).toContain(yayasanBaruId);
    expect(ids.length).toBeGreaterThanOrEqual(2);

    const viharas = await apiCall<Daftar<{ id: number }>>(adminToken, "/api/viharas");
    const viharaIds = viharas.body.data.map((v) => v.id);
    expect(viharaIds).toContain(viharaBaruId);
    expect(viharaIds).toContain(viharaYdi.VVG);
  });
});
