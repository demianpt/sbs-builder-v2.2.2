import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { useAdvancedBuilder } from './support/builder-mode.mjs';

const catalog = JSON.parse(readFileSync(new URL('../../src/data/dst-data.json', import.meta.url), 'utf8'));

/**
 * "Bright background, bright text."
 *
 * Every other check in this suite reasons about colour from the project model,
 * which is the same model the mistakes are made in — a card whose scrim never
 * rendered, a band that painted its own background, a heading inheriting an
 * inverted class from a section that turned out light. None of those are visible
 * from there.
 *
 * These tests measure the rendered page instead: real computed colours against
 * the first opaque thing behind them, across every archetype the builder ships
 * and every family it can place.
 */

const FAMILIES = ['hero', 'stats', 'cards', 'slider', 'timeline', 'split', 'faq', 'pricing', 'testimonial', 'gallery', 'text', 'cta'];
const ARCHETYPES = Object.keys(catalog.archetypeStyles);

async function boot(page) {
  await page.setViewportSize({ width: 1680, height: 1050 });
  await useAdvancedBuilder(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__SBS_TEST_API));
}

/** The audit the builder runs on its own preview, read back after a render. */
async function legibility(page) {
  await expect.poll(() => page.evaluate(() => Boolean((window.__SBS_TEST_API.state.previewAudit || {}).legibility)), { timeout: 15_000 }).toBe(true);
  return page.evaluate(() => window.__SBS_TEST_API.state.previewAudit.legibility);
}

async function buildPage(page, archetype) {
  await page.locator('[data-step="1"]').click();
  await page.locator(`[data-archetype="${archetype}"]`).click();
  await page.evaluate((families) => window.__SBS_TEST_API.brain.applyCustomFlow({ name: 'contrast probe', rationale: 't', families }), FAMILIES);
}

test.describe('every band can be read', () => {
  test('no archetype produces a section whose text is lost in its own background', async ({ page }) => {
    await boot(page);
    const broken = [];
    let measured = 0;
    for (const archetype of ARCHETYPES) {
      await buildPage(page, archetype);
      const result = await legibility(page);
      measured += result.checked;
      for (const failure of result.failures) {
        broken.push(`${archetype} · ${failure.id.replace(/-[^-]+-[^-]+$/, '')} · ${failure.ratio}:1 · "${failure.sample}"`);
      }
    }
    // Proof the measurement ran rather than quietly finding nothing to look at.
    expect(measured).toBeGreaterThan(ARCHETYPES.length * 3);
    expect(broken).toEqual([]);
  });

  test('text over a photograph is left to the overlay controls, not measured against the page', async ({ page }) => {
    await boot(page);
    await buildPage(page, 'A');
    const result = await legibility(page);
    // A hero is white type on a picture behind a scrim. Measuring it against the
    // page paper would report 1.1:1 for a headline anyone can read, so those
    // bands are excluded rather than reported as failures.
    expect(result.sections.some((entry) => entry.id.includes('hero'))).toBe(false);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  test('catches a band that really is unreadable', async ({ page }) => {
    await boot(page);
    await buildPage(page, 'A');
    await legibility(page);
    // Paint one band's own text almost exactly its own ground, the way a bad
    // pattern default or a hand edit would.
    await page.evaluate(() => {
      const api = window.__SBS_TEST_API;
      const design = api.state.project.design;
      design.paletteLocked = true;
      design.palette.ink = design.palette.bg;
      api.state.project.sections.forEach((section) => api.state.project.sections.indexOf(section));
      document.querySelector('#editorInner [data-bind]')?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect.poll(async () => (await legibility(page)).failures.length, { timeout: 15_000 }).toBeGreaterThan(0);
    const checks = await page.evaluate(() => window.__SBS_TEST_API.validate().checks);
    const rendered = checks.find((check) => check.code === 'RENDER-CONTRAST');
    expect(rendered.status).toBe('fail');
    expect(rendered.detail).toMatch(/:1/);
  });
});

test.describe('the palette the brief asked for', () => {
  test('a stated colour survives every archetype, and the page stays readable', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__SBS_TEST_API.state.project.brief.notes = 'We are a golf club. Make it green and white.';
    });
    // Green becomes the brand colour and white the page — never the other way
    // round, and never white as the inverted band.
    const directives = await page.evaluate(() => window.__SBS_TEST_API.briefDirectives());
    expect(directives.palette).toMatchObject({ accent: '#1F6F43', bg: '#FFFFFF' });
    expect(directives.palette.dark).toBeUndefined();

    for (const archetype of ['A', 'B', 'J']) {
      await buildPage(page, archetype);
      const design = await page.evaluate(() => window.__SBS_TEST_API.state.project.design);
      expect(design.palette.accent.toLowerCase()).toBe('#1f6f43');
      const result = await legibility(page);
      expect(result.failures).toEqual([]);
    }
  });

  test('shows what it measured, and what it had to move', async ({ page }) => {
    await boot(page);
    await page.locator('[data-step="1"]').click();
    await page.locator('[data-archetype="F"]').click();
    // Six pairings on screen under the swatches, so legibility is not a
    // judgement the strategist has to make by eye.
    await expect(page.locator('.palette-health li')).toHaveCount(6);
    await expect(page.locator('.palette-health__head b')).toHaveText('Every pairing is readable');
    // F ships a near-black band on a near-black page, which the builder lifts.
    await expect(page.locator('.palette-health__note')).toContainText('Adjusted for readability');
    await expect(page.locator('.palette-health__note')).toContainText('hue you chose is intact');
  });
});
