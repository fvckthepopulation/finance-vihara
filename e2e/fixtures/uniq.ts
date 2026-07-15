/**
 * Helpers untuk identifier unik per-run agar test idempotent
 * (gak nyangkut di unique constraint database antar run berulang).
 */

export function uniq(prefix: string): string {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

/**
 * Short unique code for master records whose `code` column is capped (max 16
 * chars on supplier/customer). e.g. uniqCode("CUST-E2E") → "CUST-E2E-K2J9QX".
 */
export function uniqCode(prefix: string): string {
  const stamp = Date.now().toString(36).slice(-6).toUpperCase();
  return `${prefix}-${stamp}`;
}

export function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}
