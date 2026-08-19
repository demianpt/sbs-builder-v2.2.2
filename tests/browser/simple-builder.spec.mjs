import { expect, test } from '@playwright/test';
import { useAdvancedBuilder } from './support/builder-mode.mjs';

/**
 * The simple builder: four steps, one paragraph, three concepts.
 *
 * The concept endpoint is stubbed so these tests describe the product contract
 * rather than the model's mood. The one thing every test here ultimately guards
 * is that a concept is *only* a design: switching V1/V2/V3 at any step must
 * never disturb content, flow or module work.
 */

const BRIEF_TEXT = `Harbour Dental is a family dental practice in Portsmouth offering routine, cosmetic and emergency care. Our audience is local families and nervous adult patients who have avoided the dentist for years. We want them to book their first appointment online. We offer gentle, judgement-free dentistry with same-week emergency appointments and clear fixed pricing. The tone should be calm, plain and reassuring.`;

const CONCEPT_SET = {
  source: 'ai',
  degraded: null,
  model: 'gemma4:31b',
  briefText: BRIEF_TEXT,
  confidence: 0.9,
  missingFields: [],
  readback: {
    business: 'A family dental practice in Portsmouth.',
    audience: 'Local families and nervous adult patients.',
    offer: 'Gentle dentistry with fixed pricing.',
    goal: 'Book a first appointment online.',
    voice: 'Calm, plain and reassuring.',
  },
  fields: {
    industry: 'Family dental practice in Portsmouth offering routine, cosmetic and emergency care.',
    audience: 'Local families and nervous adult patients who have avoided the dentist for years.',
    goal: 'Book a first appointment online.',
    offer: 'Gentle, judgement-free dentistry with same-week emergency appointments.',
    tone: 'Calm, plain and reassuring.',
    keywords: 'gentle care, fixed pricing',
    clientName: 'Harbour Dental',
  },
  concepts: [
    { slot: 'V1', name: 'Clean and professional', archetypeKey: 'D', archetypeName: 'Clean / Utility SaaS', preset: 'calm', buttonStyle: 'solid-shift', dialOverrides: { motion: 18 }, why: 'The brief asks for plain and reassuring.' },
    { slot: 'V2', name: 'Warm and welcoming', archetypeKey: 'C', archetypeName: 'Warm / Human Modern', preset: 'friendly', buttonStyle: 'pill-glow', dialOverrides: { corner: 80 }, why: 'A family practice reads best warm.' },
    { slot: 'V3', name: 'Editorial and considered', archetypeKey: 'A', archetypeName: 'Editorial Authority', preset: 'editorial', buttonStyle: 'offset-block', dialOverrides: {}, why: 'Authority reassures nervous patients.' },
  ],
  flows: [
    { id: 'B2', reason: 'Trust before the ask suits a nervous audience.', fit: 0.94 },
    { id: 'C3', reason: 'Lead capture puts the booking path first.', fit: 0.82 },
    { id: 'B1', reason: 'Testimonials reduce fear.', fit: 0.71 },
    { id: 'E2', reason: 'A richer service conversion journey adds more supporting modules.', fit: 0.63 },
    { id: 'E4', reason: 'Authority plus resources adds a different content rhythm.', fit: 0.57 },
  ],
};

async function stubBrain(page, overrides = {}) {
  await page.route('**/api/brief/**', async (route) => {
    const url = route.request().url();
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.endsWith('/status')) return json({ provider: 'ollama', model: 'gemma4:31b', configured: true, available: true, modelAvailable: true });
    if (url.endsWith('/concepts')) {
      if (overrides.conceptsError) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: overrides.conceptsError }) });
      return json({ ...CONCEPT_SET, ...overrides.concepts });
    }
    if (url.endsWith('/expand')) return json({ source: 'ai', model: 'gemma4:31b', briefText: BRIEF_TEXT, ...CONCEPT_SET.fields, projectName: 'Harbour Dental', notes: '' });
    if (url.endsWith('/outline')) return json({ source: 'ai', model: 'gemma4:31b', name: 'Typed', rationale: 'r', steps: [{ requested: 'Hero', family: 'hero', reason: 'r' }, { requested: 'Pricing', family: 'pricing', reason: 'r' }], added: [], unresolved: [] });
    if (url.endsWith('/content')) {
      const families = JSON.parse(route.request().postData()).families;
      return json({
        source: 'ai', degraded: null, model: 'gemma4:31b', families,
        sections: families.map((family) => ({
          family, pretitle: 'Pre', title: `Copy for ${family}`, subtitle: '', body: '', items: [], buttons: [],
        })),
      });
    }
    return json({});
  });
}

async function boot(page) {
  await page.setViewportSize({ width: 1680, height: 1050 });
  await useAdvancedBuilder(page);
  await bootFresh(page);
}

/**
 * A boot with no seeded preference, for the one test that is *about* which
 * builder a session comes back to. Everything else seeds the advanced builder
 * so it can describe the switch rather than the default.
 */
async function bootFresh(page) {
  await page.setViewportSize({ width: 1680, height: 1050 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__SBS_TEST_API));
}

async function enterSimple(page) {
  await boot(page);
  await page.locator('[data-builder-mode="simple"]').click();
  await expect(page.locator('#simple-brief')).toBeVisible();
}

/** Step 01 all the way to three concepts on screen. */
async function buildConcepts(page) {
  await enterSimple(page);
  await page.locator('#simple-brief').fill(BRIEF_TEXT);
  await page.locator('[data-brain-action="build-concepts"]').click();
  await expect(page.locator('.concept-card')).toHaveCount(3);
}

function designOf(page) {
  return page.evaluate(() => {
    const api = window.__SBS_TEST_API;
    const design = api.state.project.design;
    return {
      archetype: design.archetype,
      accent: design.palette.accent,
      fontDisplay: design.fontDisplay,
      buttonStyle: design.buttonStyle,
      dials: api.design.dialKeys.map((key) => design[key]).join(','),
    };
  });
}

function projectWork(page) {
  return page.evaluate(() => {
    const project = window.__SBS_TEST_API.state.project;
    return {
      flowId: project.flowId,
      families: project.sections.map((section) => section.family).join(','),
      titles: project.sections.map((section) => section.content.title).join('|'),
      header: project.header.logoText,
      step: window.__SBS_TEST_API.state.currentStep,
    };
  });
}

test.describe('the builder mode switch', () => {
  // Which builder a *fresh* visitor lands in is asserted in builder-upgrades.spec:
  // these tests seed the advanced preference the way a returning session would,
  // so they can describe the switch rather than the default.
  test('names which builder you are in', async ({ page }) => {
    await stubBrain(page);
    await boot(page);
    await expect(page.locator('[data-builder-mode="advanced"]')).toHaveClass(/is-active/);
    await expect(page.locator('[data-builder-mode="advanced"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-builder-mode="simple"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#sideKicker')).toHaveText('Advanced builder');
    await expect(page.locator('body')).toHaveClass(/is-advanced-builder/);
    await expect(page.locator('.step-btn')).toHaveCount(5);
  });

  test('switching swaps the steps, the chrome and the step count', async ({ page }) => {
    await stubBrain(page);
    await boot(page);
    await page.locator('[data-builder-mode="simple"]').click();
    await expect(page.locator('[data-builder-mode="simple"]')).toHaveClass(/is-active/);
    await expect(page.locator('#sideKicker')).toHaveText('Simple builder');
    await expect(page.locator('body')).toHaveClass(/is-simple-builder/);
    await expect(page.locator('.step-btn')).toHaveCount(4);
    await expect(page.locator('.step-btn .step-copy b')).toHaveText(['Brief and Direction', 'Page flow', 'Modules', 'Review & export']);
    await expect(page.locator('.nav-hint')).toContainText('Step 1 of 4');

    await page.locator('[data-builder-mode="advanced"]').click();
    await expect(page.locator('.step-btn')).toHaveCount(5);
    await expect(page.locator('.step-btn .step-copy b').first()).toHaveText('Brief');
  });

  test('the export button is gone from the chrome in both builders', async ({ page }) => {
    await stubBrain(page);
    await boot(page);
    for (const mode of ['advanced', 'simple']) {
      await page.locator(`[data-builder-mode="${mode}"]`).click();
      const visible = await page.evaluate(() => {
        const button = document.getElementById('topExportBtn');
        return button ? !button.hidden && getComputedStyle(button).display !== 'none' : false;
      });
      expect(visible, mode).toBe(false);
    }
    // Undo, redo and Open preview keep their place on the right.
    const order = await page.evaluate(() => {
      const bar = document.querySelector('.topbar');
      const spacer = bar.querySelector('.top-spacer');
      const after = [];
      let node = spacer.nextElementSibling;
      while (node) { if (node.id || node.className) after.push(node.id || node.className.split(' ')[0]); node = node.nextElementSibling; }
      return after;
    });
    expect(order).toContain('top-group');
    expect(order).toContain('openPreviewBtn');
  });

  test('the chosen builder survives a reload', async ({ page }) => {
    await stubBrain(page);
    // No seeded preference: a fresh session opens on the simple builder, so the
    // choice this test follows is the move away from it.
    await bootFresh(page);
    await expect(page.locator('#sideKicker')).toHaveText('Simple builder');

    await page.locator('[data-builder-mode="advanced"]').click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sbs-dst-page-builder-v2') || '{}').builderMode)).toBe('advanced');
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__SBS_TEST_API));
    await expect(page.locator('#sideKicker')).toHaveText('Advanced builder');
    await expect(page.locator('.step-btn')).toHaveCount(5);
  });
});

test.describe('simple builder · Step 01 Brief and Direction', () => {
  test('asks for one paragraph and nothing else', async ({ page }) => {
    await stubBrain(page);
    await enterSimple(page);
    await expect(page.locator('#simple-brief')).toHaveCount(1);
    // The nine separate brief fields belong to the advanced builder.
    const binds = await page.$$eval('#editorInner [data-bind]', (nodes) => nodes.map((node) => node.dataset.bind));
    expect(binds.filter((path) => path.startsWith('brief.'))).toEqual([]);
    // Palette, type and the button family live on this step.
    await expect(page.locator('.palette-row .color-field')).toHaveCount(5);
    await expect(page.locator('[data-bind="design.fontDisplay"]')).toHaveCount(1);
    await expect(page.locator('.btn-style-card')).toHaveCount(10);
  });

  test('keeps navigation and footer collapsed', async ({ page }) => {
    await stubBrain(page);
    await enterSimple(page);
    const collapsible = page.locator('.panel-collapsible');
    await expect(collapsible).toHaveCount(1);
    expect(await collapsible.evaluate((node) => node.open)).toBe(false);
    await expect(collapsible).toContainText('Navigation and footer');
    await collapsible.locator('summary').click();
    expect(await collapsible.evaluate((node) => node.open)).toBe(true);
    await expect(collapsible.locator('[data-bind="global.header.logoText"]')).toHaveCount(1);
  });

  test('builds three concepts, each with its own style, buttons and dials', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    const concepts = await page.evaluate(() => window.__SBS_TEST_API.simple.ensure().concepts);
    expect(concepts.map((concept) => concept.slot)).toEqual(['V1', 'V2', 'V3']);
    expect(new Set(concepts.map((concept) => concept.archetypeKey)).size).toBe(3);
    expect(new Set(concepts.map((concept) => concept.preset)).size).toBe(3);
    expect(new Set(concepts.map((concept) => concept.buttonStyle)).size).toBe(3);
    // Each card explains itself.
    for (const [index, concept] of concepts.entries()) {
      const card = page.locator('.concept-card').nth(index);
      await expect(card).toContainText(concept.name);
      await expect(card).toContainText(concept.why);
      await expect(card).toContainText(concept.archetypeName);
    }
    // And the readback proves the paragraph was read.
    await expect(page.locator('.brain-readback.is-simple')).toContainText('A family dental practice in Portsmouth.');
    await expect(page.locator('.brain-readback.is-simple')).toContainText('90% confident');
  });

  test('mirrors the paragraph into the advanced builder brief fields', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    const brief = await page.evaluate(() => window.__SBS_TEST_API.state.project.brief);
    expect(brief.clientName).toBe('Harbour Dental');
    expect(brief.projectName).toBe('Harbour Dental');
    expect(brief.industry).toContain('Family dental practice');
    expect(brief.audience).toContain('nervous adult patients');
    expect(brief.goal).toContain('Book a first appointment');
    expect(brief.tone).toContain('Calm');
  });

  test('will not let you leave until a concept is chosen', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    // Nothing is pre-selected: choosing is the step's exit condition.
    expect(await page.evaluate(() => window.__SBS_TEST_API.simple.ensure().active)).toBeNull();
    await expect(page.locator('.nav-btn.next')).toBeDisabled();
    await expect(page.locator('.nav-hint')).toContainText('choose a concept');
    // Even a direct step click is refused.
    await page.locator('[data-step="2"]').click();
    expect(await page.evaluate(() => window.__SBS_TEST_API.state.currentStep)).toBe(0);

    await page.locator('[data-concept-pill="1"]').click();
    await expect(page.locator('.nav-btn.next')).toBeEnabled();
    await page.locator('.nav-btn.next').click();
    expect(await page.evaluate(() => window.__SBS_TEST_API.state.currentStep)).toBe(1);
  });

  test('reports a model failure without losing the paragraph', async ({ page }) => {
    await stubBrain(page, { conceptsError: { code: 'OLLAMA_UNAVAILABLE', message: 'down' } });
    await enterSimple(page);
    await page.locator('#simple-brief').fill(BRIEF_TEXT);
    await page.locator('[data-brain-action="build-concepts"]').click();
    await expect(page.locator('.brain-error')).toContainText('could not be reached');
    expect(await page.locator('#simple-brief').inputValue()).toBe(BRIEF_TEXT);
    await expect(page.locator('[data-brain-action="build-concepts"]')).toBeEnabled();
  });

  test('labels a degraded set as coming from the built-in planner', async ({ page }) => {
    await stubBrain(page, { concepts: { source: 'deterministic', degraded: { code: 'OLLAMA_UNAVAILABLE', message: 'The AI model could not answer in time, so the built-in planner answered instead.' } } });
    await buildConcepts(page);
    await expect(page.locator('.brain-source.is-local')).toContainText('Built-in planner');
  });
});

test.describe('the V1/V2/V3 pills', () => {
  test('appear over the preview and follow you through every step', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    await expect(page.locator('#conceptBar')).toBeVisible();
    await expect(page.locator('.concept-pill')).toHaveCount(3);
    await expect(page.locator('.concept-pill')).toHaveText(['V1', 'V2', 'V3']);
    await expect(page.locator('#conceptBarName')).toContainText('Choose one to continue');

    await page.locator('[data-concept-pill="0"]').click();
    for (const step of [1, 2, 3]) {
      await page.locator('.nav-btn.next').click();
      expect(await page.evaluate(() => window.__SBS_TEST_API.state.currentStep)).toBe(step);
      await expect(page.locator('#conceptBar'), `step ${step}`).toBeVisible();
      await expect(page.locator('.concept-pill'), `step ${step}`).toHaveCount(3);
    }
  });

  test('are hidden in the advanced builder', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    await page.locator('[data-concept-pill="0"]').click();
    await expect(page.locator('#conceptBar')).toBeVisible();
    await page.locator('[data-builder-mode="advanced"]').click();
    await expect(page.locator('#conceptBar')).toBeHidden();
  });

  test('each pill applies a materially different design to the live page', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    const designs = [];
    for (const index of [0, 1, 2]) {
      await page.locator(`[data-concept-pill="${index}"]`).click();
      await expect(page.locator(`[data-concept-pill="${index}"]`)).toHaveClass(/is-active/);
      designs.push(await designOf(page));
    }
    expect(new Set(designs.map((design) => JSON.stringify(design))).size).toBe(3);
    expect(new Set(designs.map((design) => design.archetype)).size).toBe(3);
    expect(new Set(designs.map((design) => design.accent)).size).toBe(3);
    expect(new Set(designs.map((design) => design.buttonStyle)).size).toBe(3);
    expect(new Set(designs.map((design) => design.dials)).size).toBe(3);

    // And the rendered page really changes with it. The preview is rebuilt on a
    // debounce, so poll rather than reading the frame the instant the pill is hit.
    await expect.poll(() => page.locator('#sitePreview').evaluate((frame) => {
      const site = frame.contentDocument.getElementById('sbs-site');
      return `${site.dataset.buttonStyle}|${getComputedStyle(site).getPropertyValue('--dst--primary-color2').trim().toLowerCase()}`;
    })).toBe(`${designs[2].buttonStyle}|${designs[2].accent.toLowerCase()}`);
  });

  test('switching concepts never disturbs content, flow or module work', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    await page.locator('[data-concept-pill="0"]').click();
    // Step 02: choose a flow.
    await page.locator('.nav-btn.next').click();
    await page.locator('[data-brain-action="apply-flow"]').first().click();
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.flowId)).toBe('B2');
    // Step 03: edit content and the global header.
    await page.locator('.nav-btn.next').click();
    await page.locator('#editorInner [data-bind$=".title"]').first().fill('Gentle dentistry for nervous patients');
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.sections[0].content.title)).toBe('Gentle dentistry for nervous patients');

    const before = await projectWork(page);
    for (const index of [1, 2, 0, 2]) {
      await page.locator(`[data-concept-pill="${index}"]`).click();
      await page.waitForTimeout(120);
    }
    const after = await projectWork(page);
    expect(after).toEqual(before);
    // The design did change, which is the only thing a concept may change.
    expect((await designOf(page)).archetype).toBe('A');
  });

  test('a design edit stays with the concept it was made on', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    await page.locator('[data-concept-pill="0"]').click();
    // The simple builder has no dial panel: the AI sets the dials per concept.
    // Palette is the design control it does expose on this step.
    await page.locator('[data-bind="design.palette.accent"]').evaluate((input) => {
      input.value = '#123456';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.design.palette.accent)).toBe('#123456');
    // Away and back: the edit belongs to V1, not to whatever was last applied.
    await page.locator('[data-concept-pill="1"]').click();
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.design.palette.accent)).not.toBe('#123456');
    await page.locator('[data-concept-pill="0"]').click();
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.design.palette.accent)).toBe('#123456');
  });

  test('choosing a concept is one undo step', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    await page.locator('[data-concept-pill="0"]').click();
    const first = await designOf(page);
    await page.locator('[data-concept-pill="2"]').click();
    expect((await designOf(page)).archetype).toBe('A');
    await page.locator('#undoBtn').click();
    await expect.poll(() => designOf(page).then((design) => design.archetype)).toBe(first.archetype);
  });
});

test.describe('simple builder · Step 02 Page flow', () => {
  test('shows only the three recommendations', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    await page.locator('[data-concept-pill="0"]').click();
    await page.locator('.nav-btn.next').click();

    await expect(page.locator('.brain-flow-list li')).toHaveCount(3);
    // The full library and the page sequence are not on this step.
    await expect(page.locator('.flow-card')).toHaveCount(0);
    await expect(page.locator('.module-row')).toHaveCount(0);
    await expect(page.locator('#editorInner')).not.toContainText('SBS flow library');
    await expect(page.locator('#editorInner')).not.toContainText('Choose the argument');
    await expect(page.locator('#editorInner')).not.toContainText('Current page sequence');
    // The typed-outline builder is still here.
    await expect(page.locator('#brain-outline')).toHaveCount(1);
  });

  test('applying a recommendation rebuilds the page', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    await page.locator('[data-concept-pill="0"]').click();
    await page.locator('.nav-btn.next').click();
    await page.locator('[data-brain-action="apply-flow"]').first().click();
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.flowId)).toBe('B2');
    const patterns = await page.evaluate(() => window.__SBS_TEST_API.state.project.sections.map((section) => section.patternId));
    const known = await page.evaluate(() => window.__SBS_TEST_API.patternIds);
    for (const pattern of patterns) expect(known).toContain(pattern);
  });
});

test.describe('simple builder · Step 03 Modules', () => {
  async function openModules(page) {
    await stubBrain(page);
    await buildConcepts(page);
    await page.locator('[data-concept-pill="0"]').click();
    await page.locator('.nav-btn.next').click();
    await page.locator('.nav-btn.next').click();
    await expect(page.locator('.module-row').first()).toBeVisible();
  }

  test('has the page sequence, three tabs, no extended view and no DST tree', async ({ page }) => {
    await openModules(page);
    await expect(page.locator('.module-row')).toHaveCount(6);
    await expect(page.locator('.view-switch')).toHaveCount(0);
    await expect(page.locator('[data-module-view]')).toHaveCount(0);
    await expect(page.locator('[data-editor-tab]')).toHaveText(['Content', 'Media', 'Layout + effects']);
    await expect(page.locator('[data-editor-tab="advanced"]')).toHaveCount(0);
    await expect(page.locator('#editorInner')).not.toContainText('DST tree');
  });

  test('offers one button that fills the page with copy from the brief', async ({ page }) => {
    await openModules(page);
    // Showing a client three concepts carrying the demo project's copy would
    // defeat the whole exercise, so the copywriter lives on this step.
    await expect(page.locator('[data-brain-action="write-content"]')).toHaveCount(1);
    const before = await page.evaluate(() => window.__SBS_TEST_API.state.project.sections.map((section) => section.content.title));
    await page.locator('[data-brain-action="write-content"]').click();
    await expect(page.locator('.brain-draft ol > li')).toHaveCount(before.length);
    await page.locator('[data-brain-action="apply-content"]').click();
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.sections[0].content.title)).toBe('Copy for hero');
    // One undo returns the whole page, and the flow is untouched.
    await page.locator('#undoBtn').click();
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.sections.map((section) => section.content.title))).toEqual(before);
  });

  test('the layout tab shows only the plain-language groups', async ({ page }) => {
    await openModules(page);
    await page.locator('[data-editor-tab="layout"]').click();
    const groups = await page.$$eval('.fidelity-group__head h3', (nodes) => nodes.map((node) => node.textContent));
    expect(groups).toContain('How this section looks');
    expect(groups).toContain('How it arrives');
    expect(groups).toContain('Decorative pattern');
    // The overlay controls are here too. They are the fix for the one failure a
    // strategist actually sees — white type on a pale photograph — so hiding
    // them behind a view this builder does not have was a dead end.
    expect(groups).toContain('Background and image overlay');
    const binds = await page.$$eval('#editorInner [data-bind]', (nodes) => nodes.map((node) => node.dataset.bind));
    expect(binds.filter((path) => /\.(?:[a-zA-Z]*(?:Tablet|Mobile)|margin)\b/i.test(path))).toEqual([]);
    // Nothing numeric is typed: every quantity in this view is a slider.
    const numeric = await page.$$eval('#editorInner input[data-bind]', (nodes) => nodes.map((node) => node.type));
    expect(numeric).not.toContain('number');
  });

  /*
   * The overlay is the fix for the one failure a strategist can actually see —
   * a headline that has disappeared into a bright photograph — so it has to be
   * reachable from the builder they are standing in, with sliders rather than a
   * box wanting a number between 0 and 1.
   */
  test('the overlay can be changed here, by dragging', async ({ page }) => {
    await openModules(page);
    await page.locator('[data-editor-tab="layout"]').click();
    await expect(page.locator('[data-fidelity-overlay-control]')).toHaveCount(1);

    const strength = page.locator('input[data-bind$=".surface.overlayOpacity"]');
    await expect(strength).toHaveAttribute('type', 'range');
    await strength.fill('80');
    await expect.poll(() => page.evaluate(() => {
      const api = window.__SBS_TEST_API;
      return api.state.project.sections.find((s) => s.id === api.state.selectedSectionId).fidelity.surface.overlayOpacity;
    })).toBe(0.8);

    const sectionId = await page.evaluate(() => window.__SBS_TEST_API.state.selectedSectionId);
    await expect.poll(() => page.locator('#sitePreview').evaluate((frame, id) => {
      const overlay = frame.contentDocument.querySelector(`#${id} .c-overlay`);
      return overlay ? getComputedStyle(overlay).opacity : null;
    }, sectionId)).toBe('0.8');
  });

  test('the mobile menu style is offered here too, not only in the advanced builder', async ({ page }) => {
    await openModules(page);
    // Step 01 in the simple builder, where the global parts live behind a
    // collapsed panel: optional, but reachable without switching builders.
    await page.locator('[data-step="0"]').click();
    await page.locator('.panel-collapsible', { hasText: 'Navigation and footer' }).locator('summary').click();
    const select = page.locator('select[data-bind="global.header.mobileMenu"]');
    await expect(select).toHaveCount(1);
    const styles = await select.locator('option').evaluateAll((nodes) => nodes.map((node) => node.value));
    expect(styles).toEqual(['center', 'left', 'right', 'aurora']);
    await select.selectOption('aurora');
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.simple.buildConceptExport().concept.global.navigation.nav.mobileMenu)).toBe('aurora');
  });

  test('a persisted extended-view preference does not leak in', async ({ page }) => {
    await stubBrain(page);
    await boot(page);
    // Turn extended on in the advanced builder first.
    await page.locator('[data-step="3"]').click();
    await page.locator('.module-row').first().click();
    await page.locator('[data-editor-tab="layout"]').click();
    await page.locator('[data-module-view="extended"]').click();
    await expect(page.locator('[data-module-view="extended"]')).toHaveClass(/active/);
    await page.locator('[data-builder-mode="simple"]').click();
    await expect(page.locator('.view-switch')).toHaveCount(0);
    expect(await page.evaluate(() => window.__SBS_TEST_API.state.moduleView)).toBe('simple');
  });
});

test.describe('simple builder · Step 04 Review and export', () => {
  async function openReview(page) {
    await stubBrain(page);
    await buildConcepts(page);
    await page.locator('[data-concept-pill="1"]').click();
    for (let step = 0; step < 3; step += 1) await page.locator('.nav-btn.next').click();
    await expect(page.locator('.check-list')).toBeVisible();
  }

  test('offers exactly one download: the concept JSON', async ({ page }) => {
    await openReview(page);
    const exports = await page.$$eval('[data-export]', (nodes) => nodes.map((node) => node.dataset.export));
    expect(exports).toEqual(['simple-concept']);
    await expect(page.locator('#editorInner')).not.toContainText('Standalone website HTML');
    await expect(page.locator('#editorInner')).not.toContainText('Complete project bundle');
    await expect(page.locator('#editorInner')).toContainText('switch to the Advanced builder');
  });

  test('the JSON carries the page, the navigation, the footer, the brief and all three concepts', async ({ page }) => {
    await openReview(page);
    const json = await page.evaluate(() => window.__SBS_TEST_API.simple.buildConceptExport());
    expect(json.artifactType).toBe('simple-concept');
    expect(json.concept.page.sections.length).toBeGreaterThan(0);
    expect(json.concept.global.navigation).toBeTruthy();
    expect(json.concept.global.footer).toBeTruthy();
    expect(json.simpleBuilder.briefText).toBe(BRIEF_TEXT);
    expect(json.simpleBuilder.concepts).toHaveLength(3);
    expect(json.simpleBuilder.active).toBe(1);
    expect(json.simpleBuilder.fields.clientName).toBe('Harbour Dental');
    // The editing model, without which an import loses every edit.
    expect(json.simpleBuilder.sections).toHaveLength(json.concept.page.sections.length);
    expect(json.simpleBuilder.sections[0].content.title).toBeTruthy();
    // And the design slice, so the concept looks the same after the handoff.
    expect(json.concept.design.archetype).toBe('C');
    expect(json.concept.design.buttonStyle).toBe('pill-glow');
    expect(json.concept.design.palette.accent).toBeTruthy();
  });

  test('shows the same preflight gates the advanced builder uses', async ({ page }) => {
    await openReview(page);
    const codes = await page.$$eval('.check code', (nodes) => nodes.map((node) => node.textContent));
    expect(codes.length).toBeGreaterThanOrEqual(27);
    expect(codes).toContain('CONTRAST');
    expect(codes).toContain('BUTTONS');
  });
});

test.describe('the handoff into the advanced builder', () => {
  test('imports a concept JSON with every edit, field and concept intact', async ({ page }) => {
    await stubBrain(page);
    await buildConcepts(page);
    await page.locator('[data-concept-pill="1"]').click();
    await page.locator('.nav-btn.next').click();
    await page.locator('[data-brain-action="apply-flow"]').first().click();
    await page.locator('.nav-btn.next').click();
    await page.locator('#editorInner [data-bind$=".title"]').first().fill('Gentle dentistry for nervous patients');
    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.sections[0].content.title)).toBe('Gentle dentistry for nervous patients');

    const source = await page.evaluate(() => ({
      json: JSON.stringify(window.__SBS_TEST_API.simple.buildConceptExport()),
      design: window.__SBS_TEST_API.state.project.design.archetype,
      button: window.__SBS_TEST_API.state.project.design.buttonStyle,
      families: window.__SBS_TEST_API.state.project.sections.map((section) => section.family).join(','),
    }));

    // A clean advanced project, then import.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__SBS_TEST_API));
    expect(await page.evaluate(() => window.__SBS_TEST_API.simple.mode())).toBe('advanced');
    await page.evaluate(async (json) => {
      const file = new File([json], 'concept.json', { type: 'application/json' });
      await window.__SBS_TEST_API.simple.importConcept(file);
    }, source.json);

    await expect.poll(() => page.evaluate(() => window.__SBS_TEST_API.state.project.sections[0].content.title)).toBe('Gentle dentistry for nervous patients');
    const imported = await page.evaluate(() => {
      const api = window.__SBS_TEST_API;
      const project = api.state.project;
      return {
        mode: api.simple.mode(),
        step: api.state.currentStep,
        families: project.sections.map((section) => section.family).join(','),
        flowId: project.flowId,
        archetype: project.design.archetype,
        buttonStyle: project.design.buttonStyle,
        brief: project.brief,
        concepts: api.simple.ensure().concepts.length,
        active: api.simple.ensure().active,
      };
    });
    expect(imported.mode).toBe('advanced');
    expect(imported.step).toBe(0);
    expect(imported.families).toBe(source.families);
    expect(imported.flowId).toBe('B2');
    expect(imported.archetype).toBe(source.design);
    expect(imported.buttonStyle).toBe(source.button);
    expect(imported.concepts).toBe(3);
    expect(imported.active).toBe(1);
    // The whole point of the handoff: the individual brief fields are filled in.
    expect(imported.brief.clientName).toBe('Harbour Dental');
    expect(imported.brief.industry).toContain('Family dental practice');
    expect(imported.brief.audience).toContain('nervous adult patients');
    expect(imported.brief.goal).toContain('Book a first appointment');
    expect(imported.brief.tone).toContain('Calm');
    expect(imported.brief.notes).toContain('Harbour Dental is a family dental practice');
    // And the advanced builder is fully itself again.
    await expect(page.locator('.step-btn')).toHaveCount(5);
  });

  test('the import control lives in the advanced builder Step 01 only', async ({ page }) => {
    await stubBrain(page);
    await boot(page);
    await expect(page.locator('[data-concept-import]')).toHaveCount(1);
    await page.locator('[data-step="1"]').click();
    await expect(page.locator('[data-concept-import]')).toHaveCount(0);
    await page.locator('[data-builder-mode="simple"]').click();
    await expect(page.locator('[data-concept-import]')).toHaveCount(0);
  });

  test('refuses a file that is not a concept JSON, without damaging the project', async ({ page }) => {
    await stubBrain(page);
    await boot(page);
    const before = await projectWork(page);
    await page.evaluate(async () => {
      const file = new File(['{"nope":true}'], 'bad.json', { type: 'application/json' });
      await window.__SBS_TEST_API.simple.importConcept(file);
    });
    await expect(page.locator('#toastText')).toContainText('no page sections');
    expect(await projectWork(page)).toEqual(before);
  });
});

test.describe('the advanced builder is unchanged', () => {
  test('keeps its five steps, extended view, DST tree and every export', async ({ page }) => {
    await stubBrain(page);
    await boot(page);
    await expect(page.locator('.step-btn')).toHaveCount(5);
    await page.locator('[data-step="3"]').click();
    await page.locator('.module-row').first().click();
    await expect(page.locator('[data-editor-tab]')).toHaveText(['Content', 'Media', 'Layout + effects', 'DST tree']);
    await page.locator('[data-editor-tab="layout"]').click();
    await expect(page.locator('.view-switch')).toHaveCount(1);
    await page.locator('[data-step="4"]').click();
    const exports = await page.$$eval('[data-export]', (nodes) => nodes.map((node) => node.dataset.export));
    expect(exports.length).toBeGreaterThan(1);
    expect(exports).toContain('html');
  });

  test('still has the full flow library and its nine brief fields', async ({ page }) => {
    await stubBrain(page);
    await boot(page);
    const binds = await page.$$eval('#editorInner [data-bind]', (nodes) => nodes.map((node) => node.dataset.bind));
    expect(binds.filter((path) => path.startsWith('brief.')).length).toBeGreaterThanOrEqual(8);
    await page.locator('[data-step="2"]').click();
    expect(await page.locator('.flow-card').count()).toBeGreaterThanOrEqual(30);
    await expect(page.locator('.module-row').first()).toBeVisible();
  });
});
