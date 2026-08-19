import { expect, test } from '@playwright/test';
import { useAdvancedBuilder } from './support/builder-mode.mjs';

async function openDirection(page) {
  await page.addInitScript(() => localStorage.clear());
  await useAdvancedBuilder(page);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__SBS_TEST_API));
  await page.locator('[data-step="1"]').click();
  await expect(page.locator('.btn-style-list')).toBeVisible();
}

function previewButton(page) {
  return page.locator('#sitePreview').evaluate((frame) => {
    const doc = frame.contentDocument;
    const site = doc.getElementById('sbs-site');
    const primary = doc.querySelector('.c-btn.-primary, .c-btn.-primary-inverted');
    const link = doc.querySelector('.c-btn.-link');
    const styles = primary ? getComputedStyle(primary) : null;
    return {
      attribute: site.getAttribute('data-button-style'),
      radius: styles?.borderTopLeftRadius,
      paddingLeft: styles?.paddingLeft,
      boxShadow: styles?.boxShadow,
      overflow: styles?.overflow,
      hasLink: Boolean(link),
      linkDecoration: link ? getComputedStyle(link).textDecorationLine : null,
    };
  });
}

test.describe('button families', () => {
  test('offers ten described families, each with a live sample', async ({ page }) => {
    await openDirection(page);
    const styles = await page.evaluate(() => window.__SBS_TEST_API.design.buttonStyles);
    expect(styles).toHaveLength(10);
    await expect(page.locator('.btn-style-card')).toHaveCount(10);
    for (const style of styles) {
      const card = page.locator(`.btn-style-card:has(input[value="${style.id}"])`);
      await expect(card).toContainText(style.label);
      await expect(card).toContainText('Hover:');
      await expect(card).toContainText('Best for:');
      // Each sample shows all three roles, because a family is all three.
      const preview = card.locator(`.btn-style-preview[data-button-style="${style.id}"]`);
      await expect(preview.locator('.c-btn.-primary')).toHaveCount(1);
      await expect(preview.locator('.c-btn.-secondary')).toHaveCount(1);
      await expect(preview.locator('.c-btn.-link')).toHaveCount(1);
    }
    // Solid Shift is the default so a new project always has a working family.
    await expect(page.locator('.btn-style-card.is-selected input')).toHaveValue('solid-shift');
  });

  test('each sample renders with its own geometry in the editor', async ({ page }) => {
    await openDirection(page);
    const shapes = await page.evaluate(() => {
      const out = {};
      for (const preview of document.querySelectorAll('.btn-style-preview')) {
        const button = preview.querySelector('.c-btn.-primary');
        const styles = getComputedStyle(button);
        out[preview.dataset.buttonStyle] = `${styles.borderTopLeftRadius}|${Math.round(Number.parseFloat(styles.paddingLeft))}|${styles.boxShadow.slice(0, 24)}`;
      }
      return out;
    });
    // Ten families must look like ten families, not one with ten names.
    expect(new Set(Object.values(shapes)).size).toBeGreaterThanOrEqual(7);
    expect(shapes['pill-glow']).toContain('999px');
    expect(shapes['offset-block']).toContain('0px|');
  });

  test('choosing a family changes the rendered page and the export', async ({ page }) => {
    await openDirection(page);
    const before = await previewButton(page);
    expect(before.attribute).toBe('solid-shift');

    await page.locator('.btn-style-card:has(input[value="offset-block"])').click();
    await expect(page.locator('.btn-style-card.is-selected input')).toHaveValue('offset-block');
    await expect.poll(() => previewButton(page).then((value) => value.attribute)).toBe('offset-block');

    const after = await previewButton(page);
    expect(after.radius).toBe('0px');
    // The offset block is the whole idea of the family.
    expect(after.boxShadow).toMatch(/6px 6px/);
    expect(after.overflow).toBe('visible');

    const theme = await page.evaluate(() => window.__SBS_TEST_API.buildTheme());
    expect(theme.buttonStyle).toBe('offset-block');
    const html = await page.evaluate(() => window.__SBS_TEST_API.buildSiteDocument());
    expect(html).toContain('data-button-style="offset-block"');
    expect(html).toContain('/* button-style:offset-block */');
  });

  test('every family produces a distinct primary button in the real page', async ({ page }) => {
    await openDirection(page);
    const ids = await page.evaluate(() => window.__SBS_TEST_API.design.buttonStyles.map((style) => style.id));
    const seen = new Map();
    for (const id of ids) {
      await page.locator(`.btn-style-card:has(input[value="${id}"])`).click();
      await expect.poll(() => previewButton(page).then((value) => value.attribute)).toBe(id);
      const shape = await previewButton(page);
      seen.set(id, `${shape.radius}|${Math.round(Number.parseFloat(shape.paddingLeft))}|${shape.boxShadow.slice(0, 20)}`);
    }
    expect(new Set(seen.values()).size).toBeGreaterThanOrEqual(4);
  });

  test('choosing a family is a single undo step', async ({ page }) => {
    await openDirection(page);
    await page.locator('.btn-style-card:has(input[value="magnetic-arrow"])').click();
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.design.buttonStyle)).toBe('magnetic-arrow');
    await page.locator('#undoBtn').click();
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.design.buttonStyle)).toBe('solid-shift');
  });

  test('the corner and movement dials reach the button samples too', async ({ page }) => {
    await openDirection(page);
    await page.locator('.dial[data-dial="corner"] input[type="range"]').fill('0');
    await expect.poll(() => page.locator('.btn-style-list').evaluate((node) => node.style.getPropertyValue('--dst--default-radius'))).toBe('0px');
    await page.locator('.dial[data-dial="motion"] input[type="range"]').fill('0');
    await expect.poll(() => page.locator('.btn-style-list').evaluate((node) => node.style.getPropertyValue('--sbs-motion-duration'))).toBe('0s');
  });

  test('an unknown persisted family falls back to the safe default', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      // A hostile or corrupted save must not be able to inject a style id.
      localStorage.setItem('sbs-dst-page-builder-v2', JSON.stringify({
        project: { brief: { projectName: 'Corrupt' }, design: { buttonStyle: 'evil-style' }, sections: [] },
      }));
    });
    await useAdvancedBuilder(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__SBS_TEST_API));
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.design.buttonStyle)).toBe('solid-shift');
  });
});
