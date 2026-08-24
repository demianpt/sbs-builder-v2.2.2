import { expect, test } from '@playwright/test';
import { useAdvancedBuilder } from './support/builder-mode.mjs';

/**
 * Decisions about individual patterns that no rule can derive.
 *
 * How many quotes a pull-quote band shows, where a column sits in its row,
 * whether a picture should hold still while the copy beside it scrolls. They live
 * in `scripts/clean-patterns.mjs` as a table rather than hand-edited into the
 * data, so they survive a re-ingest — and here as assertions, so a re-ingest that
 * skipped them fails rather than quietly reverting the page.
 */

async function boot(page) {
  await page.addInitScript(() => localStorage.clear());
  await useAdvancedBuilder(page);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__SBS_TEST_API));
}

/** Renders one pattern on its own and reads the markup back. */
function render(page, patternId, read) {
  return page.evaluate(({ id, source }) => {
    const inspect = new Function(`return (${source})`)();
    const api = window.__SBS_TEST_API;
    const pattern = api.catalog.all().find((entry) => entry.id === id);
    if (!pattern) throw new Error(`no such pattern: ${id}`);
    const section = api.createSection(pattern.family, 0, id);
    api.state.project.sections.push(section);
    const doc = new DOMParser().parseFromString(api.buildSiteDocument(), 'text/html');
    api.state.project.sections.pop();
    const band = doc.getElementById(section.id);
    if (!band) throw new Error(`${id} rendered nothing`);
    return inspect(band, doc);
  }, { id: patternId, source: read.toString() });
}

test.describe('how many quotes a testimonial band shows', () => {
  /*
   * A pull-quote band shows one large quote; a card band shows two or three.
   * Which it is belongs to the pattern, not the family — sweeping the whole
   * family to three across turned every one of these into the same three-up grid.
   */
  const ACROSS = {
    'sbs-testimonial-p15-v1': 1,
    'sbs-testimonial-p15-v2': 1,
    'sbs-testimonial-p43-v1': 1,
    'sbs-testimonial-p43-v2': 2,
    'sbs-testimonial-p10-v1': 2,
  };

  for (const [id, across] of Object.entries(ACROSS)) {
    test(`${id} shows ${across} at a time`, async ({ page }) => {
      await boot(page);
      const grid = await render(page, id, (band) => {
        const node = band.querySelector('.dst-cards__grid');
        return node ? node.getAttribute('style') : '';
      });
      expect(grid).toContain(`--dst-slider-cols:${across}`);
      expect(grid).toContain(`--col:${across}`);
    });
  }
});

test('the first column of p15 v2 sits at the top of its row', async ({ page }) => {
  await boot(page);
  // The pattern set the row to `end` *and* pinned this column to `bottom`, which
  // left the heading on the floor of the band beside a column of quotes. The
  // column is the one that renders `align-self`, so both had to move.
  const column = await render(page, 'sbs-testimonial-p15-v2', (band) => ({
    row: (band.querySelector('.ds-row') || {}).className || '',
    first: (band.querySelector('.ds-column') || {}).getAttribute
      ? band.querySelector('.ds-column').getAttribute('style')
      : '',
  }));
  expect(column.row).toContain('valign-start');
  expect(column.first).toContain('align-self:start');
  expect(column.first).not.toContain('align-self:end');
});

test.describe('the stats bands that put a picture beside a list', () => {
  for (const id of ['sbs-stats-p31-v2', 'sbs-stats-p31-v3']) {
    test(`${id} holds its picture at the top of the band`, async ({ page }) => {
      await boot(page);
      const band = await render(page, id, (node) => ({
        row: (node.querySelector('.ds-row') || {}).className || '',
        sticky: node.querySelectorAll('.ds-column.is-sticky-media').length,
        stickyHoldsMedia: [...node.querySelectorAll('.ds-column.is-sticky-media')]
          .every((column) => column.querySelector('.dst-media, .ph, img')),
        lists: [...node.querySelectorAll('.dst-list')].map((list) => list.className),
      }));
      // Centring a tall picture against a list twice its height leaves it
      // floating in the middle of a lot of nothing.
      expect(band.row).toContain('valign-start');
      expect(band.row).not.toContain('valign-center');
      expect(band.sticky, 'the picture column is not marked to hold').toBe(1);
      expect(band.stickyHoldsMedia).toBe(true);
      // And the list is not a container inside a band that already is one.
      for (const list of band.lists) expect(list).not.toContain('c-default');
    });
  }

  test('the held column is sticky, un-clipped, and static on a phone', async ({ page }) => {
    await boot(page);
    const css = await page.evaluate(() => window.__SBS_TEST_API.buildSiteDocument());
    // `align-self:start` is what makes sticky mean anything in a grid: a
    // stretched item is already as tall as the row and has nowhere to travel.
    expect(css).toContain('.ds-column.is-sticky-media{position:sticky;top:0;align-self:start}');
    // `overflow:hidden` anywhere above a sticky element silently turns it back
    // into a static one, and both `.has-bg-media` and the decoration layer set it.
    expect(css).toMatch(/\.dst-wrapper:has\(\.is-sticky-media\)[^{]*\{overflow:visible\}/);
    // Sticky and a single column do not mix: the picture would pin to the top and
    // the copy would scroll underneath it.
    expect(css).toMatch(/@media\(max-width:900px\)\{[^}]*is-sticky-media\{position:static\}/);
  });
});

test('the form slot is readable on its own white card', async ({ page }) => {
  await boot(page);
  const ink = await page.evaluate(() => {
    const api = window.__SBS_TEST_API;
    const read = () => {
      const css = api.buildSiteDocument();
      return (css.match(/\.sbs-form-slot\{color:(#[0-9a-fA-F]{3,8})\}/) || [])[1] || '';
    };
    const before = read();
    // A dark-ground palette makes `ink` a *pale* colour, which is right for the
    // page and wrong for the one surface that is always white.
    api.state.project.design.palette.ink = '#F4F1E8';
    api.state.project.design.palette.dark = '#EFEFEF';
    api.state.project.design.paletteLocked = true;
    const pale = read();
    return { before, pale };
  });
  const luminance = (hex) => {
    const [r, g, b] = hex.replace('#', '').match(/../g).map((pair) => Number.parseInt(pair, 16));
    return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
  };
  expect(luminance(ink.before)).toBeLessThan(0.38);
  // Nothing dark in the palette at all, so the floor applies.
  expect(ink.pale.toLowerCase()).toBe('#111111');
});

test('the closing statement takes the width it has', async ({ page }) => {
  await boot(page);
  const css = await page.evaluate(() => window.__SBS_TEST_API.buildSiteDocument());
  // The headline was clamped to twelve characters, which broke a four-word
  // sign-off across four lines.
  expect(css).toContain('.sbs-footer-statement{max-width:100%}');
  expect(css).toContain('.sbs-footer-statement .footer__nl-head{max-width:100%}');
  // The centred layout is the exception, and has to be: centring is relative to
  // something, and at full width there is nothing to centre within — that layout
  // became a copy of the editorial one.
  expect(css).toContain('.sbs-footer.footer-centered .sbs-footer-statement{max-width:105rem}');
});

test('the footer watermark is the client’s name, until somebody types their own', async ({ page }) => {
  await boot(page);
  const marks = await page.evaluate(() => {
    const api = window.__SBS_TEST_API;
    const project = api.state.project;
    const seeded = project.footer.wordmark;

    project.brief.clientName = 'Red Moon Motorcycles';
    api.ensureProject(project);
    const followed = project.footer.wordmark;

    // A leading article is dropped, and a first word too short to read as a
    // fragment takes the second with it.
    project.brief.clientName = 'The Bicycle Company';
    api.ensureProject(project);
    const article = project.footer.wordmark;
    project.brief.clientName = 'Ex Machina Studio';
    api.ensureProject(project);
    const short = project.footer.wordmark;

    // Typed by hand, it stops following.
    api.updateBinding('global.footer.wordmark', 'ATLAS');
    project.brief.clientName = 'Something Else Entirely';
    api.ensureProject(project);
    return { seeded, followed, article, short, typed: project.footer.wordmark };
  });
  // The default project is called Vision Continuity, which is why every page
  // built afterwards carried "Vision" across the bottom: the watermark was
  // seeded once and never revisited.
  expect(marks.seeded).toBe('Vision');
  expect(marks.followed).toBe('Red Moon');
  expect(marks.article).toBe('Bicycle');
  expect(marks.short).toBe('Ex Machina');
  expect(marks.typed).toBe('ATLAS');
});

test('a stats band gets figures with units, not instructions', async ({ page }) => {
  await boot(page);
  const written = await page.evaluate(() => {
    const api = window.__SBS_TEST_API;
    const project = api.state.project;
    project.brief.clientName = 'Red Moon Motorcycles';
    project.brief.industry = 'Premium motorcycle rental near the Grand Canyon';
    const section = project.sections.find((entry) => entry.family === 'stats');
    api.brain.applyContentDraft({
      sections: project.sections.filter((entry) => entry.visible !== false).map((entry) => (
        entry.family === 'stats'
          ? {
            family: 'stats',
            title: 'What the programme leaves behind',
            items: [
              { title: 'Distance covered', description: 'Across the routes we run.', value: 'Add the measured figure' },
              { title: 'Response window', description: 'From enquiry to confirmation.', value: '' },
              { title: 'Routes offered', description: 'Each one scouted.', value: 'TBC' },
            ],
          }
          : { family: entry.family, title: 'x' }
      )),
    });
    return { values: (section.content.items || []).map((item) => item.value), body: section.content.body };
  });
  // Three cards reading "Add the measured figure" is a template, not a concept —
  // and the units come from the brief's own vocabulary.
  expect(written.values).toHaveLength(3);
  for (const value of written.values) expect(value).toMatch(/\d/);
  expect(written.values.join(' ')).toMatch(/km|hrs|routes/i);
  // Said on the band rather than left for somebody to notice.
  expect(written.body).toMatch(/illustrative|demonstration/i);
});
