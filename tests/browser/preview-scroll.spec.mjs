import { expect, test } from '@playwright/test';
import { useAdvancedBuilder } from './support/builder-mode.mjs';

test('keeps the preview scroll position after a live setting change', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await useAdvancedBuilder(page);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__SBS_TEST_API));
  await page.locator('[data-step="3"]').click();
  await page.locator('.module-row').first().click();
  await page.locator('[data-editor-tab="layout"]').click();
  // The layout panel opens in Basic view; these controls live in Extended.
  await page.locator('[data-module-view="extended"]').click();

  const preview = page.locator('#sitePreview');
  await expect.poll(() => preview.evaluate((frame) => Boolean(frame.contentDocument?.querySelector('#sbs-site')))).toBe(true);
  await preview.evaluate((frame) => {
    frame.dataset.previewLoads = '0';
    frame.addEventListener('load', () => {
      frame.dataset.previewLoads = String(Number(frame.dataset.previewLoads || 0) + 1);
    });
    frame.contentWindow.scrollTo(0, 700);
  });
  await expect.poll(() => preview.evaluate((frame) => frame.contentWindow.scrollY)).toBeGreaterThan(500);

  const loadCount = await preview.evaluate((frame) => Number(frame.dataset.previewLoads));
  await page.locator('select[data-bind$=".surface.sidePadding"]').selectOption('false');
  await expect.poll(() => preview.evaluate((frame) => Number(frame.dataset.previewLoads))).toBeGreaterThan(loadCount);
  await expect.poll(() => preview.evaluate((frame) => frame.contentWindow.scrollY)).toBeGreaterThan(500);
});
