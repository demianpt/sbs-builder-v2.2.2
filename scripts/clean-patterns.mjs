#!/usr/bin/env node
/**
 * Takes the DST staging site out of the pattern library.
 *
 * The 156 patterns were exported from a live WordPress install, so each one
 * carried that install's own decisions: its media library URLs, and the overlay
 * colours whoever built the page happened to pick. Both are wrong here.
 *
 *   Media       A pattern's card pointed at
 *               `dst.dsstaging1.com/wp-content/uploads/…/exterior-facade.jpg`.
 *               That is somebody else's photograph of somebody else's building,
 *               and it wins over the imagery the builder found for *this* brief,
 *               because an attribute that is present is never replaced. Removing
 *               it lets every slot fall back to the project's own media — which
 *               is the imagery pass's output once it has run, and a labelled
 *               placeholder before that.
 *
 *   Overlays    `backgroundOverlay: '#f5f5f5'` at opacity 1 over a photograph is
 *               a flat grey rectangle where the photograph was. So were
 *               `var(--dst--secondary-color1)` (white), `#dddddd`, and a
 *               bright green gradient. The renderer already has a scrim for the
 *               one case that needs one — a title sitting on a picture — and it
 *               is a soft bottom-up gradient that darkens the type's ground
 *               without hiding the image.
 *
 *   Marquee     The logo rail listed seven real client logos by URL from that
 *               same install. Replaced with inline SVG placeholders that draw in
 *               `currentColor`, so they are legible on a dark banner and on a
 *               light one, and nothing is fetched from anywhere.
 *
 *   Columns     A `c-cards` with no column count fell back to one column, so a
 *               thirteen-card pattern rendered as thirteen full-width bands.
 *               The count is written from what the pattern actually holds.
 *
 *   Overlay     One hero faded a pale *blue* across 60% of the band. Made white,
 *   tone        which is what it was meant to be, and the band's text tone now
 *               follows the overlay rather than the family's preset.
 *
 *   node scripts/clean-patterns.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA = join(ROOT, 'src/data/dst-data.json');

/** Hosts whose media belongs to the site the patterns were exported from. */
const FOREIGN_HOST = /^https?:\/\/[a-z0-9.-]*dsstaging[0-9]*\.(?:com|local)\//i;

/*
 * Placeholder logos.
 *
 * Abstract marks rather than imitations of real brands: a logo rail's job in a
 * concept is to say "recognisable clients go here", and a fake Google wordmark
 * says something the client has not agreed to. Drawn in `currentColor` so one
 * set works on a dark banner and a light one.
 */
const LOGO_MARKS = [
  { name: 'Orbit', svg: '<circle cx="14" cy="14" r="9"/><circle cx="14" cy="14" r="3.2" fill="currentColor" stroke="none"/><path d="M44 8h10M44 14h16M44 20h7"/>' },
  { name: 'Prism', svg: '<path d="M14 5 23 22H5z"/><path d="M44 8h14M44 14h9M44 20h16"/>' },
  { name: 'Meridian', svg: '<rect x="5" y="5" width="18" height="18" rx="4"/><path d="M9 14h10"/><path d="M44 8h8M44 14h17M44 20h11"/>' },
  { name: 'Cadence', svg: '<path d="M5 18c4-11 10-11 14 0"/><path d="M5 10h14"/><path d="M44 8h16M44 14h7M44 20h13"/>' },
  { name: 'Northwood', svg: '<path d="M14 4 5 23h18z"/><path d="M14 12 9 23h10z" fill="currentColor" stroke="none"/><path d="M44 8h11M44 14h15M44 20h8"/>' },
  { name: 'Quadrant', svg: '<path d="M5 5h8v8H5zM15 15h8v8h-8z"/><path d="M44 8h13M44 14h8M44 20h16"/>' },
];

function logoImages() {
  return LOGO_MARKS.map((mark, index) => ({
    // No `url`: nothing is fetched, and the export turns this into a data URI so
    // WordPress receives a real image rather than an empty slot.
    svg: `<svg viewBox="0 0 68 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${mark.name}">${mark.svg}</svg>`,
    alt: `${mark.name} — client logo placeholder`,
    placeholder: true,
    instanceId: `logo-placeholder-${index + 1}`,
  }));
}

const CARD_SURFACES = new Set(['ds-blocks/c-cards', 'ds-blocks/c-card-item', 'ds-blocks/c-list', 'ds-blocks/c-list-item']);
const OVERLAY_KEYS = ['backgroundOverlay', 'backgroundOverlayEnabled', 'backgroundOverlayOpacity', 'mediaOverlay', 'mediaOverlayOpacity', 'backgroundOverlayBlur', 'backgroundOverlayMixBlend'];

/** Whether anything under this value still names a file. */
function namesAFile(value) {
  if (Array.isArray(value)) return value.some(namesAFile);
  if (!value || typeof value !== 'object') return false;
  if (typeof value.url === 'string' && value.url) return true;
  if (typeof value.src === 'string' && value.src) return true;
  return Object.values(value).some(namesAFile);
}

/** Every URL under this value that belongs to the exporting site. */
function stripForeignMedia(value, tally) {
  if (Array.isArray(value)) {
    const kept = value.map((entry) => stripForeignMedia(entry, tally)).filter((entry) => entry !== null);
    return kept.length ? kept : null;
  }
  if (!value || typeof value !== 'object') return value;
  const url = typeof value.url === 'string' ? value.url : (typeof value.src === 'string' ? value.src : '');
  if (url && FOREIGN_HOST.test(url)) { tally.media += 1; return null; }
  const out = {};
  let empty = true;
  for (const [key, entry] of Object.entries(value)) {
    const cleaned = stripForeignMedia(entry, tally);
    if (cleaned === null) continue;
    out[key] = cleaned;
    empty = false;
  }
  if (empty) return null;
  /*
   * A background layer that lost its file is not a background.
   *
   * The layer's other keys — `fixed`, `focal`, `size`, `width` — survive the
   * strip and leave an object that looks like a layer, renders nothing, and is
   * not empty enough to be refilled. A third of the catalogue's photographs went
   * missing that way. If it named a file and no longer does, it goes.
   */
  if (namesAFile(value) && !namesAFile(out)) return null;
  return out;
}

function countCards(node) {
  let total = 0;
  for (const child of node.children || []) {
    if (child.component === 'ds-blocks/c-card-item') total += 1;
  }
  return total;
}

function clean(node, pattern, tally) {
  const attrs = node.attributes || {};

  for (const key of ['media', 'backgroundImage', 'imagePrimary', 'video', 'posterImage']) {
    if (!(key in attrs)) continue;
    const cleaned = stripForeignMedia(attrs[key], tally);
    if (cleaned !== null) { attrs[key] = cleaned; continue; }
    /*
     * Emptied, not deleted.
     *
     * The file was the exporting site's; the *slot* is the pattern's. Deleting
     * the attribute deleted the pattern's intent along with the photograph, and
     * a thirteen-card band came back with no pictures at all. An empty object
     * means "this card has a picture and does not have a file yet", which is
     * what the builder fills from the imagery it found for the brief.
     */
    if (key === 'media' || key === 'imagePrimary') attrs[key] = {};
    // A background layer list is the same story: the list being *present* is the
    // band saying it is photo-backed. Emptied, it is filled from the project at
    // sync; deleted, the band came back a flat colour and the catalogue lost a
    // third of its photographs.
    else if (key === 'backgroundImage') attrs[key] = [];
    else delete attrs[key];
  }

  if (CARD_SURFACES.has(node.component)) {
    for (const key of OVERLAY_KEYS) {
      if (key in attrs) { delete attrs[key]; tally.overlays += 1; }
    }
  }

  // A button pointing at the exporting site's own contact page is a dead link on
  // every page built from the pattern.
  for (const key of ['link', 'button']) {
    const value = attrs[key];
    if (value && typeof value === 'object' && typeof value.url === 'string' && /dsstaging[0-9]*\.(?:com|local)/i.test(value.url)) {
      value.url = '#contact';
      delete value.id;
      delete value.kind;
      tally.links += 1;
    }
    if (value && typeof value === 'object' && value.link && typeof value.link.url === 'string' && /dsstaging[0-9]*\.(?:com|local)/i.test(value.link.url)) {
      value.link.url = '#contact';
      delete value.link.id;
      delete value.link.kind;
      tally.links += 1;
    }
  }

  if (node.component === 'ds-blocks/marquee' && Array.isArray(attrs.images)) {
    attrs.images = logoImages();
    tally.marquees += 1;
  }

  if (node.component === 'ds-blocks/c-cards') {
    const held = countCards(node);
    if (held && !Number(attrs.columnsDesktop) && !Number(attrs.columns)) {
      // Three across is the shape a card grid is designed around, and it is what
      // the renderer already falls back to; anything holding fewer than three
      // gets one column per card rather than a row with holes in it.
      const across = pattern.family === 'slider' || pattern.family === 'testimonial' ? 3 : Math.min(3, held);
      attrs.columnsDesktop = across;
      attrs.columnsTablet = Math.min(2, across);
      attrs.columnsMobile = 1;
      tally.columns += 1;
    }
    // A slider shows three at a time. Two of these patterns said two and one
    // said nothing at all, which the renderer read as one — the same card at
    // full width that made them look identical. The count lives under `columns`
    // on some patterns and `columnsDesktop` on others, so both are written.
    //
    // Testimonials are deliberately not swept with them: a pull-quote band shows
    // one large quote and a card band shows two or three, and which it is is a
    // property of the pattern rather than of the family. Those are named in
    // CORRECTIONS below.
    if (pattern.family === 'slider') {
      const across = Math.max(3, Number(attrs.columnsDesktop) || Number(attrs.columns) || 0);
      if (across !== Number(attrs.columnsDesktop) || across !== Number(attrs.columns)) tally.sliders += 1;
      attrs.columns = across;
      attrs.columnsDesktop = across;
      attrs.columnsTablet = 2;
      attrs.columnsMobile = 1;
      const settings = attrs.dstSliderSettings && typeof attrs.dstSliderSettings === 'object' ? attrs.dstSliderSettings : null;
      if (settings && Number(settings.bleedRightVisibleItems)) settings.bleedRightVisibleItems = across;
    }
  }

  // The one hero that faded pale blue across the band. It reads as a mistake
  // rather than a decision, and the band's words sit in it.
  if (node.component === 'ds-blocks/dst-banner' && typeof attrs.backgroundOverlay === 'string' && /#E3F8FF/i.test(attrs.backgroundOverlay)) {
    attrs.backgroundOverlay = attrs.backgroundOverlay.replace(/#E3F8FF/gi, '#ffffff');
    tally.heroOverlays += 1;
  }

  for (const child of node.children || []) clean(child, pattern, tally);
}

/*
 * Per-pattern corrections.
 *
 * Everything above is a rule; these are decisions about individual patterns that
 * no rule can derive — how many quotes a pull-quote band shows, where a column
 * sits in its row, whether a picture should hold still while the copy beside it
 * scrolls. Kept here rather than hand-edited into the data so they survive a
 * re-ingest and can be read as a list.
 *
 *   across      how many cards the grid shows at once (`--dst-slider-cols`)
 *   valign      the row's vertical alignment, which becomes each column's
 *               `align-self`
 *   stickyMedia the column holding the picture stays put while the column beside
 *               it scrolls
 *   fullList    the list is not a container: no `c-default`, no side padding
 */
const CORRECTIONS = {
  'sbs-testimonial-p15-v1': { across: 1 },
  'sbs-testimonial-p15-v2': { across: 1, valign: 'start' },
  'sbs-testimonial-p43-v1': { across: 1 },
  'sbs-testimonial-p43-v2': { across: 2 },
  'sbs-testimonial-p10-v1': { across: 2 },
  'sbs-stats-p31-v2': { valign: 'start', stickyMedia: true, fullList: true },
  'sbs-stats-p31-v3': { valign: 'start', stickyMedia: true },
};

function holds(node, component) {
  if (node.component === component) return true;
  return (node.children || []).some((child) => holds(child, component));
}

function correct(pattern) {
  const fix = CORRECTIONS[pattern.id];
  if (!fix) return 0;
  let changed = 0;
  const walk = (node) => {
    const attrs = node.attributes || (node.attributes = {});
    if (fix.across && node.component === 'ds-blocks/c-cards') {
      attrs.columns = fix.across;
      attrs.columnsDesktop = fix.across;
      attrs.columnsTablet = Math.min(2, fix.across);
      attrs.columnsMobile = 1;
      const settings = attrs.dstSliderSettings;
      if (settings && typeof settings === 'object' && Number(settings.bleedRightVisibleItems)) {
        settings.bleedRightVisibleItems = fix.across;
      }
      changed += 1;
    }
    if (fix.valign && node.component === 'ds-blocks/ds-columns') {
      attrs.verticalAlign = fix.valign;
      changed += 1;
    }
    /*
     * A column's own `alignVertical` beats the row's.
     *
     * `sbs-testimonial-p15-v2` set the row to `end` *and* pinned its first column
     * to `bottom`, so correcting the row alone left the heading sitting on the
     * floor of the band beside a column of quotes. The column is the one that
     * actually renders `align-self`, so both are written.
     */
    if (fix.valign && node.component === 'ds-blocks/ds-column' && attrs.alignVertical) {
      attrs.alignVertical = fix.valign === 'start' ? 'top' : fix.valign;
      changed += 1;
    }
    if (fix.stickyMedia && node.component === 'ds-blocks/ds-column' && holds(node, 'ds-blocks/c-media')) {
      // `class` is a registered attribute on every DST block, so this survives
      // the export allow-list and reaches WordPress as a real class.
      const marks = String(attrs.class || '').split(/\s+/).filter(Boolean);
      if (!marks.includes('is-sticky-media')) marks.push('is-sticky-media');
      attrs.class = marks.join(' ');
      changed += 1;
    }
    if (fix.fullList && node.component === 'ds-blocks/c-list') {
      // An empty container name resolves to `c-full` for a nested block: no
      // max-width, no side padding, no container class the band already has.
      attrs.dsContainer = '';
      changed += 1;
    }
    (node.children || []).forEach(walk);
  };
  walk(pattern.tree);
  return changed;
}

const check = process.argv.includes('--check');
const data = JSON.parse(readFileSync(DATA, 'utf8'));
const tally = { media: 0, overlays: 0, marquees: 0, columns: 0, sliders: 0, heroOverlays: 0, links: 0, corrections: 0 };
for (const pattern of data.patterns) clean(pattern.tree, pattern, tally);
for (const pattern of data.patterns) tally.corrections += correct(pattern);

// The media library and the decorations are the builder's own, not the staging
// site's — but the host repair belongs here too rather than only at boot.
const rewritten = JSON.stringify(data).replace(/dst(-dev)?\.dsstaging1\.local/g, 'dst.dsstaging1.com');
const out = JSON.parse(rewritten);

if (!check) writeFileSync(DATA, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ ...tally, wrote: !check }, null, 2));
