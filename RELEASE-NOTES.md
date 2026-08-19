# Release notes

## 2.2.2 — Simple/Advanced parity, Shutterstock URL lookup, richer flow planning

### Simple builder gets the complete Design Dials

The Simple builder now uses the same nine system-wide Design Dials and quick-style presets as Advanced. Moving a slider writes the same canonical design state and immediately changes the live preview; concept switching captures those edits instead of losing them. The Simple review step also exposes the same navigation, footer, page, standalone HTML and complete-project ZIP exports as Advanced.

### WordPress receives the resolved visual system

`page.json` now carries both the raw nine dial values and the complete resolved `sbs-design-dials/1.0` token set. The bundled WordPress importer consumes those tokens through an allowlisted mapping for containers, vertical rhythm, reading measure, type scale, card spacing/surfaces, imagery treatment and motion. This removes the previous approximation where WordPress could receive the same block tree but miss design-dial-derived presentation values.

### Shutterstock URL / ID lookup is robust

The media library accepts either a numeric Shutterstock asset ID or a full public Shutterstock asset URL, including URLs with tracking query parameters. The lookup reads the asset ID from the actual asset path before unrelated tracking numbers, resolves images first, and only checks the video catalogue when needed. Added assets remain watermarked review previews with their Shutterstock ID and licensing link.

### Five better flow recommendations

The Brief Brain now returns five flow recommendations instead of three. The recommendation catalog gains five richer 10–11 module journeys and the full in-browser library now totals 30 flows covering experience-led storytelling, service conversion, product discovery, authority/resources and community/brand storytelling. Deterministic ranking now includes a diversity pass so the five recommendations are useful alternatives rather than near-duplicates; AI prompts explicitly request varied journeys and richer flows when the brief warrants them.

### QA / regression protection

The release adds `npm run test:upgrade`, covering Shutterstock parsing/preview lookup, five-flow schemas/planning, richer-flow catalog integrity, Simple Design Dial parity, Simple/Advanced export parity hooks and WordPress design-token consumption. Browser QA verifies all nine Simple dials, live token changes, five flow recommendations, Simple export actions and byte-equivalent Simple/Advanced page JSON after timestamp normalization. The WordPress unit and full 154-pattern catalog sweeps remain part of the handoff checks.

## 2.2.1 — The mobile navigation

### The menu toggle was invisible on every palette

Not a contrast oversight — a specificity one. The toggle is a `<button>`, and a
button does **not** inherit `color`: the user-agent `buttontext` keyword wins. So
`background:currentColor` on the bars resolved to pure black on every theme,
which is black-on-near-black on any dark palette. It was also two 1px hairlines,
so even where the colour happened to contrast it read as a smudge.

The colour is now chosen by measured contrast against the canvas the header sits
on — the palette's dark tone on a light canvas, white on a dark one — so it holds
for all thirteen archetypes and any hand-edited palette. Measured: 15.5:1 on
archetype A, 19.7:1 on F, 13.3:1 on C. The bars are three, 2px, in a 44px target.

### The toggle animates

Three bars spread slightly on hover, then the outer two cross to an X while the
middle one scales away. Speed comes from the Movement dial, and zero means no
transition at all.

### Tablet and mobile get a real takeover

Opening the menu now fills the viewport: content centred on both axes, links in
the display face at `clamp(2.8rem, 7.2vw, 4.8rem)` — 48px on tablet, 28px on
mobile, against the 14.5px it was — arriving one after another. The brand stays
pinned top-left and the close control top-right. The call to action, previously
hidden behind the menu that replaced it, is now in the menu. Page scroll is
locked while it is open, `aria-expanded` and the label track the state, and
Escape closes it and returns focus to the toggle.

All of it ships in the exported standalone HTML, not just the preview.

## 2.2.0 — The simple builder

A second builder, over the same project model. The advanced builder is unchanged;
this adds a narrower path designed for one job — getting three credible concepts
in front of a client in one sitting — and a clean handoff into the advanced
builder afterwards.

### The switch

A labelled two-state control in the top bar. The sidebar heading, the step list
and the accent colour all change with it, so which builder you are in is never a
guess. The choice persists.

The **Export page JSON** button is gone from the chrome in both builders —
exporting belongs at the end of the flow. Undo, redo and Open preview sit on the
right.

### Simple builder · Step 01 Brief and Direction

One textarea replaces the nine brief fields. The brain reads it and returns:

- a five-line readback, so a wrong reading is obvious before anything is built;
- **three complete concepts**, each with its own archetype, palette, type, all
  nine design dials (via a named quick style plus deliberate nudges) and a button
  family, with a sentence explaining why;
- the three best page flows for the brief.

Palette, type and the button family are on this step. Navigation and footer are
collapsed by default. The step cannot be left until a concept is chosen.

### The V1/V2/V3 pills

Float over the live preview at every step. Clicking one applies that concept
immediately.

A concept resolves to the design slice and nothing else, which is what makes this
safe: switch concepts after choosing a flow, writing copy and editing a module and
all of that work is untouched. A design edit made while a concept is selected is
recorded on that concept, so previewing another and coming back keeps it.

### Simple builder · Steps 02–04

- **Page flow** — the three recommendations and the typed-outline builder. The
  30-flow library and the page sequence are not on this step.
- **Modules** — the page sequence, one button that writes the whole page's copy
  from the brief, and a module editor with Content, Media and Layout + effects.
  No Extended view, no DST tree.
- **Review & export** — the same 27 preflight gates, and one download: a concept
  JSON carrying the page, the navigation, the footer, the brief, the design and
  all three concepts.

### The handoff

Import that JSON in the advanced builder's Step 01, by file picker or drag and
drop. Sections, content, flow, custom flows, globals, design and all three
concepts come across, and the paragraph is split into the nine brief fields so
every later AI job has what it needs. The mode switches to advanced on import.

### Two AI jobs added

`POST /api/brief/concepts` and `POST /api/brief/expand`, both with deterministic
twins. The concept job refuses a set where two concepts share an archetype, and
refuses any archetype, quick style, button family or flow id outside the catalog
it was sent.

### Fixes found while building this

- The feature's event bridge was handed a different context object from its
  panels, so a concept click reached a context with no `applyConcept` on it.
  There is now one context.
- `normalizeApiError` reported *any* non-network error as "start the local
  server", which sent the user to fix the wrong thing and hid the real fault. It
  now names the actual error and logs the stack.
- `Number(null)` is `0`, so the "nothing chosen yet" state was silently
  pre-selecting V1 and defeating the first step's exit condition.
- The concept export carried the DST node tree but not the builder's own section
  model, so an import rebuilt every module from pattern defaults and discarded
  the copy the strategist had written.
- A palette edit made on a concept was lost when previewing another concept and
  returning, because only dials were captured.

### Tests

125 unit/integration tests and 116 Playwright tests, all passing, plus the
unchanged WordPress handoff suite (19/19 assertions).

## 2.1.0 — AI Brief Brain, design dials, button families

### The AI model now reads the brief

The **Website inspiration / Style DNA** panel is gone, along with its whole
server pipeline (browser capture, screenshot analysis, job store, blend
synthesis). The one configured Ollama model now does three jobs driven entirely
by the Step 01 brief:

- **Step 01 — read my brief.** The brain reads back what it understood, field by
  field, beside the strategist's own words, with a confidence score. It then
  recommends one DST visual archetype and the three best page flows, each with a
  reason drawn from the brief. It can also draft the copy for every section in
  the current flow.
- **Step 03 — plan the flow.** The same model ranks every flow in the library,
  and turns a typed outline ("The page will have 1. Hero 2. Before after image
  gallery 3. A pricing 4. Testimonials") into a real sequence of registered DST
  modules. Any mapping can be corrected without retyping the outline.

The model may only choose from vocabularies the server sends it, every answer is
schema-validated, and nothing it produces can introduce a component or attribute
that is not registered. When the model is unavailable or answers off-contract, a
deterministic planner answers instead and the UI says so.

### Design dials that are actually visible

The three old dials moved measurable tokens but produced changes a strategist
could not see. There are now **nine dials** — Density, Reading width, Headline
size, Brand colour emphasis, Surface definition, Corner softness, Image
presence, Movement and Expression — grouped into six labelled sections, each
with a plain-language readout ("48 · Balanced") and a sentence explaining what it
changes.

Two structural changes make them obvious:

- Each dial drives a wide range of CSS custom properties *and* a discrete band
  (`data-density-level`, `data-motion-level`, …) that switches whole rules on, so
  crossing a band is unmistakable.
- Step 02 shows a **live sample** that reflects the dials without scrolling the
  preview, including a **Replay the movement** button.

Measured across the full range on the default page: headline 58px → 148px, hero
height 522px → 900px, section gap 15.4vmin → 4.8vmin, header 108px → 64px, card
radius 0 → 44px, reveal travel 0 → 92px, reveal duration 0s → 0.96s, logo
marquee 96s → 14s. Movement at 0 switches motion off entirely and reveals all
content immediately.

### Five button families

Where Style DNA used to be, Step 02 now offers five complete button systems —
**Solid Shift**, **Sweep Fill**, **Offset Block**, **Pill Glow** and **Magnetic
Arrow** — each defining the primary action, the secondary action and the text
link together with its own hover behaviour. Each is shown as a live, hoverable
sample built from the real DST markup and the real CSS. The choice applies to
every registered button in the preview and travels into the theme export.

### Basic and Extended module views

Step 04 opens in **Basic view**: the six choices a strategist understands, in
plain language, with no padding tokens or breakpoint values. **Extended view**
still exposes every registered DST attribute. The choice persists.

### More page flows and more preflight checks

- The flow library grew from 20 to **30** flows.
- Preflight grew from 14 checks to **27**, adding placeholder-copy detection,
  headline length, duplicate headlines, proof presence, closing action, section
  rhythm, page length, button family, motion budget, palette contrast, type
  scale, brief completeness, AI provenance and flow provenance.

### Preview

- The preview pane is about 20% wider (988px instead of 808px at 1680px).
- The tablet gained a bezel to match the phone, drawn with box-shadow rings so
  the emulated viewport stays exactly 820px.
- Fixed: the desktop preview was being flex-shrunk to 1418px instead of 1440px.

### Component defaults and corrections

- **Card media overlays never rendered.** `dst-shared.css` carries
  `.dst-card--media-background > *:not(.c-block__media){position:relative}`,
  which is more specific than `.c-block__scrim{position:absolute}`, so the scrim
  lost its geometry, collapsed to a zero-height flow element, and every
  media-background card put white text straight onto a photograph. The scrim's
  own geometry and the media/scrim/copy stacking order are now re-stated from
  inside `#sbs-site`.
- **Card grids open four across** (two on tablet, one on mobile), capped by the
  item count so three cards never leave a hole where a fourth should be.
- **Logo bands read as one row** — six across, four on tablet, two on mobile —
  instead of a single stacked column.
- **Contact bands ship a flat 50% wash** so the form and its labels are legible
  over a photograph. The alpha lives in the colour and the element opacity stays
  at 1, because setting both would multiply into a 25% wash while the control
  still claimed 50%.
- **Accordions animate open and closed.** Native `<details>` does not, so this
  uses `::details-content` with an interpolatable `auto`; a browser without
  either support drops the rules and the accordion still opens, just instantly.
  Speed comes from the Movement dial, with a floor so a disclosure never reads
  as a page reload — except at zero, where Still means still.
- **The preview follows the selected module.** Choosing a row in either module
  list scrolls the preview to that section, landing it just below the sticky
  header, and marks it for a moment so you can see where you are.

### Hero fit

- A hero with a centred heading kept a left-pinned inner, so a "centred" hero
  read as off-centre on every wide screen.
- A hero built from a two-column layout inherited the single-column cap of
  `min(74rem, 56vw)` and squeezed the copy and image into a third of the page
  each. Those heroes now fall back to the authored `--cw`, so a deliberate
  `contentWidth` is still honoured and only the hero's own editorial cap is
  dropped. The `11ch` display measure is also relaxed inside a column.

### Fixes found while building this

- A saved project whose `sections` was not an array bricked the editor
  permanently; it now falls back to a fresh project.
- The module-editor view preference was not persisted.
- `ensureBrainState` replaced the state object, silently detaching in-flight
  async writes.
- A disabled-state patch left `aria-disabled="true"` behind, announcing an
  enabled button as disabled.
- The deterministic draft under-filled sections that render a fixed item count.
- The new preview-follows-selection scroll left its pending target armed after a
  successful scroll, so the next unrelated preview rebuild jumped back to the
  last selected module instead of holding the reader's position. Caught by the
  existing `preview-scroll` test only when the whole suite ran together.

### Tests

93 unit/integration tests and 85 Playwright tests, all passing, plus the
unchanged WordPress handoff suite (19/19 assertions).

## 2.0.0

Complete project bundle ZIP, editable navigation and footer template parts,
layout fidelity controls, and the tailored WordPress importer.
