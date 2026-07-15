import { Locator, expect } from "@playwright/test";

/**
 * Select an option by partial label text (regex). Playwright's selectOption
 * only accepts exact label strings, so this finds the first matching option text
 * and uses it. Waits up to 5s for at least one matching option to appear
 * (handles async-loaded dropdowns).
 */
export async function selectByLabelRegex(select: Locator, pattern: RegExp): Promise<void> {
  await expect.poll(
    async () => {
      const labels = await select.locator("option").allTextContents();
      return labels.some((l) => pattern.test(l));
    },
    { timeout: 5000, message: `Timed out waiting for option matching ${pattern}` },
  ).toBeTruthy();

  const labels = await select.locator("option").allTextContents();
  const match = labels.find((l) => pattern.test(l));
  if (!match) {
    throw new Error(`No option matches ${pattern}. Available: ${labels.join(" | ").slice(0, 200)}`);
  }
  await select.selectOption({ label: match });
}

/**
 * Wait for a select to have N+1 options (1 placeholder + N real items).
 * Useful when a dropdown is async-loaded.
 */
export async function waitForOptions(select: Locator, minCount = 2): Promise<void> {
  await expect.poll(
    async () => (await select.locator("option").count()),
    { timeout: 5000 },
  ).toBeGreaterThanOrEqual(minCount);
}
