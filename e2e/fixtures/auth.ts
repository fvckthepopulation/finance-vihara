import { Page } from "@playwright/test";

// Vihara Finance test users — sync dengan seeder API.
// Password seragam "password".
export const USERS = {
  admin: { email: "admin@vihara.test", password: "password" },        // superadmin, tanpa vihara tetap
  bendahara: { email: "bendahara@vvg.test", password: "password" },   // bendahara, terkunci ke vihara VVG
  approver: { email: "approver@vvg.test", password: "password" },     // approver VVG
  viewer: { email: "viewer@vvg.test", password: "password" },         // viewer VVG (read-only)
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
