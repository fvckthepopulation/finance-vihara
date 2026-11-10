import { Page } from "@playwright/test";

// Vihara Finance test users — sync dengan RbacSeeder di API.
// Password seragam "password".
//
// Hirarki akses (users.scope_type):
//   global -> semua yayasan & semua vihara
//   entity -> semua vihara di satu yayasan + data level yayasan
//   vihara -> HANYA vihara yang di-assign (bisa satu, bisa beberapa)
export const USERS = {
  admin: { email: "admin@vihara.test", password: "password" },            // superadmin, scope global
  adminYayasan: { email: "yayasan@ydi.test", password: "password" },      // admin_yayasan, scope entity YDI
  pengawas: { email: "pengawas@ydi.test", password: "password" },         // pengawas_yayasan, scope entity, read-only
  bendahara: { email: "bendahara@vvg.test", password: "password" },       // bendahara, scope vihara [VVG]
  bendaharaVbm: { email: "bendahara@vbm.test", password: "password" },    // bendahara, scope vihara [VBM]
  bendaharaMulti: { email: "bendahara.multi@ydi.test", password: "password" }, // scope vihara [VVG, VAD]
  approver: { email: "approver@vvg.test", password: "password" },         // approver VVG
  viewer: { email: "viewer@vvg.test", password: "password" },             // viewer VVG (read-only)
} as const;

export type UserKey = keyof typeof USERS;

export async function login(page: Page, user: UserKey): Promise<void> {
  const creds = USERS[user];
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/dashboard");
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Keluar" }).click();
  await page.waitForURL("**/login");
}

// ---------------------------------------------------------------------------
// Helper API langsung — untuk menguji penegakan hirarki di level HTTP, bukan
// hanya di UI. Isolasi antar vihara harus tegak walau UI dilewati sama sekali.
// ---------------------------------------------------------------------------

export const API_BASE = process.env.E2E_API_URL ?? "http://localhost:8500";

/** Ambil token Sanctum lewat /api/login. */
export async function apiToken(user: UserKey | { email: string; password: string }): Promise<string> {
  const creds = typeof user === "string" ? USERS[user] : user;
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  if (!res.ok) throw new Error(`login ${creds.email} gagal: HTTP ${res.status}`);
  const json = (await res.json()) as { token: string };
  return json.token;
}

export type ApiResult<T = unknown> = { status: number; body: T };

/** Panggil API dengan token; mengembalikan status + body (tidak melempar). */
export async function apiCall<T = unknown>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body: body as T };
}

export type MeProfile = {
  email: string;
  scope_type: "global" | "entity" | "vihara";
  vihara_ids: number[] | null;
  can_see_yayasan_level: boolean;
  entity_id: number | null;
  roles: string[];
  permissions: string[];
  app: { single_entity_mode: boolean };
};

export async function apiMe(token: string): Promise<MeProfile> {
  const { body } = await apiCall<MeProfile>(token, "/api/me");
  return body;
}

/** Peta kode vihara → id, diambil sebagai admin global. */
export async function viharaIdsByCode(): Promise<Record<string, number>> {
  const token = await apiToken("admin");
  const { body } = await apiCall<{ data: { id: number; code: string }[] }>(
    token,
    "/api/viharas",
  );
  const map: Record<string, number> = {};
  for (const v of body.data) map[v.code] = v.id;
  return map;
}

/** Parse "Rp 1.234.567" (atau "-Rp 1.234") → 1234567 / -1234. */
export function parseRp(text: string): number {
  const negative = text.includes("-");
  const digits = text.replace(/[^\d]/g, "");
  const value = Number(digits || 0);
  return negative ? -value : value;
}

/**
 * Pilih vihara VVG (label mengandung "Vipassan") di select topbar
 * `aria-label="Pilih vihara"`, lalu beri waktu refetch data.
 */
export async function pickViharaVVG(page: Page): Promise<void> {
  const select = page.getByLabel("Pilih vihara");
  // Opsi dimuat async — tunggu opsi VVG muncul dulu.
  await select.locator("option").filter({ hasText: "Vipassan" }).waitFor({ state: "attached", timeout: 10_000 });
  const labels = await select.locator("option").allTextContents();
  const match = labels.find((l) => l.includes("Vipassan"));
  if (!match) throw new Error(`No vihara option containing "Vipassan". Got: ${labels.join(" | ")}`);
  await select.selectOption({ label: match });
  await page.waitForTimeout(800); // refetch data setelah ganti vihara
}
