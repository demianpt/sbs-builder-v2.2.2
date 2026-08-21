# Release notes

## 2.7.0 — One button

"Read my brief and build 3 concepts" was three buttons on three steps, and the
middle one needed a fourth press before anything it wrote reached the page:

1. Step 01 — read the brief, get three concepts.
2. Step 01 or 03 — write the page copy. *Then press Apply.*
3. Step 03 — find the imagery.

Not one of those presses was a decision. Every one of them had to happen before
a page could be shown to anybody, and the draft nobody reads before applying is
a confirmation dialog with extra steps. So it is one press, and it does all of
it:

**Read my brief and build 3 concepts** → designs three concepts · writes the copy
for every section and puts it on the page · finds the imagery and places it.

### The order changed, and that is the point

The old flow generated the three concept workspaces first and dressed the page
afterwards — which left the copy and the pictures in whichever workspace happened
to be open. The new order dresses the page and forks it last:

1. read the brief — the readback, the fields, the three concept designs;
2. write the copy and put it on the page;
3. find the imagery and place it;
4. **then** clone that page into V1, V2 and V3, each resolving its own design.

Now all three concepts carry the same real copy and the same real pictures and
differ only in design, which is the entire reason to show a client three of them.

### Two of the four jobs are allowed to fail

A brief that produced three concepts is worth keeping even when the copywriter
times out, and stock imagery is a separately configured service that many servers
do not have. Neither is a reason to throw away the rest, so both are best-effort
and both say what happened. The panel shows the counts when it is done —
"3 concepts designed · 6 sections written and applied · 6 pictures found and
placed" — and any note underneath: the copywriter unreachable, stock not
configured, a slot that kept its placeholder rather than repeat a picture.

### It says which job it is on

Four jobs behind one press is most of a minute of waiting, and a button that just
sits there reads as a hang. The press names the stage it is in and ticks off the
ones it finished.

### What went away

- The **"Write the page copy" / "Apply this content"** pair in the simple builder
  — both presses, on Step 01 *and* Step 03. The `renderSimpleContentPanel` panel
  and the copywriter block are deleted, not hidden.
- Step 03's imagery panel is now the **library** rather than a step: it says
  Step 01 already searched, and its button is a re-run for a different set.

The advanced builder is deliberately untouched. Its write-then-review-then-apply
sequence is the reason it exists: it is used on pages that already have
hand-written copy, where overwriting without reading the draft first is the whole
risk. One model, one set of jobs, two front doors with different promises.

Measured against the real thing — a ten-page client PDF dropped on Step 01, then
one press: three concepts designed, six sections written and applied ("Ride the
Grand Canyon in Style", "More Than Just a Rental", "From Booking to Open Road"),
twelve previews found and six placed, and all three concepts carrying the same
page.

## 2.6.0 — The brief arrives as a file, and the pictures arrive by hand

### The client's own brief, dropped straight in

The brief that actually exists is a PDF the client exported or a Word document
from a discovery call, and the only way in was to open it somewhere else, select
all, and paste. Now the whole window takes a file: drag one anywhere over the
builder and a sheet appears; drop it and the words are read.

Every format is read **in the browser** with no dependency and no upload — a
`.docx` is a ZIP of XML and a PDF's text lives in deflated content streams, and
the platform already ships the one primitive both need. The client's document
therefore never leaves the machine, which for a brief under NDA is the difference
between usable and not.

- **`.docx`** — the ZIP central directory, then `word/document.xml` (plus foot and
  end notes), with paragraphs, tabs and breaks kept.
- **`.rtf`, `.txt`, `.md`, `.csv`, `.json`, `.html`** — markup stripped to prose.
- **PDF** — see below; it turned out to be the whole job.

#### A PDF does not contain text

The first version of this read the bytes of every content stream, which works on
a PDF written by hand and fails on every PDF anybody actually has. A real Word or
Pages export uses two kinds of font at once: body copy in a `WinAnsiEncoding`
TrueType font, where a byte is nearly a character, and everything the exporter
subset — headings, links, bullets — in a `Type0`/`Identity-H` font, where a
*pair* of bytes is a glyph number with no relationship to any alphabet. Read
straight through, half the document comes back as noise, which is
indistinguishable from a scan. That is exactly what a real ten-page meeting-notes
PDF did: "probably a scan", with 12,000 characters of readable brief inside it.

So `shared/brief/pdf.mjs` now does what a reader does:

- finds the indirect objects, **including the ones packed inside a compressed
  object stream** — which is where every exporter since PDF 1.5 puts its page and
  font dictionaries, so a reader that only scans the file body finds no pages at
  all;
- walks the page tree, so pages come out in reading order rather than file order;
- resolves each page's fonts and each font's **`/ToUnicode` CMap** — the table the
  exporter shipped precisely so the text could be got back — handling single
  codes, listed runs, spanned runs and multi-character destinations;
- interprets the content stream tracking the selected font, and decodes every
  shown string through it;
- follows the pen, because Word places every *run* of a sentence separately: one
  for the bold part, one for the link, one for the superscript. Treating each
  placement as a new line returns a document one or two words per line. A move
  that changes the vertical position is a line; a move along the same line is a
  space — and only if the gap is wider than the estimated advance of what was
  just drawn, or every hyphenated word arrives as "multi - language".

Word gaps still come out of the kerning as well, because a PDF stores no spaces:
a `TJ` adjustment past a third of an em is where a typesetter put one.

Deliberately absent: encryption, CFF charset reconstruction, and any attempt to
invent text for a font with no `/ToUnicode` at all. Those are reported as
unreadable with the reason, which is more use than a page of glyph numbers.

#### The brief the model reads is no longer four thousand characters

Reading the document was only half of it. `briefText` was capped at 4,000
characters end to end — textarea, request, server — so a 12,000-character
discovery document arrived and immediately lost its last two thirds. In a
discovery document that is the audience, the scope, the budget and the page list:
everything worth reading. The trim was reported honestly and was still useless.

The cap is now **16,000 characters** — about four thousand tokens, a full
discovery document, and a small fraction of the model's context — stated once in
`shared/brief/schemas.mjs` and taken from there by the browser, the server, the
textarea's own limit and the file reader. The internal note that keeps the
document verbatim went from 2,000 to 6,000.

Measured against the real thing: a ten-page client PDF now reads whole, and the
concepts the brain returns cite the target audience from page 2 and the "Book a
ride" call to action from page 7 — neither of which it could previously see.

What it cannot read is named rather than hidden. A scanned PDF is a picture of
text with no text in it, and it says so — "probably a scan… copy the text out and
paste it instead" — instead of filling the brief with glyph soup, which is decided
by measuring how much of the extraction is actually letters. A `.doc` from an old
Word version is refused by name with the fix ("save it as .docx or PDF first"). A
drop of four files where one is a scan places the other three and reports the
fourth.

Where it lands is the difference between the two builders. The **simple builder**
gets the paragraph, appended under anything already written, each file under its
own name so a discovery deck and a tone-of-voice note do not run together. The
**advanced builder** gets the fields: the text goes through the same splitter a
simple-builder import uses, and the document is kept verbatim as the internal
note. If the brief server is not reachable the words are still kept, and the toast
says the split is what was missing rather than pretending it worked.

The same drop still recognises a concept export and imports it as a concept.

### A picture, dragged onto the module it is for

The imagery was in the editor and the page was in the preview. Getting one into
the other meant selecting the module, opening its Media tab, finding the slot in a
list and clicking a tile — three decisions to express one: *this* picture,
*there*.

Every tile is now draggable — the found-imagery gallery, the module picker and the
placeholder library — and every module in the preview is a target. Which slot it
lands in is read from what the pointer is actually over: a card takes that card's
picture, a split takes that half's, a band with no picture under the pointer takes
its background. The slot list is the same one the stock-imagery job fills, so a
slot that can be dropped on is a slot the pattern really renders. The module is
outlined and the exact slot is ringed while the pointer is over them, one drop is
one undo, and the module dropped on becomes the selected one so the editor follows.

A module of people refuses the drop and says why: a testimonial face has to be the
client's own colleague, not a stock model, and that rule now shows itself at the
moment somebody tries.

### The navigation's own controls stay put

The controls moved out of the navigation in 2.5.0, into a strip below it — and
became unusable. The strip is drawn over whatever module follows the header, so
reaching a button meant crossing those pixels, one `mousemove` retargeted the
overlay to the hero, and the arrows were gone before the pointer arrived. The
navigation could be looked at and never changed.

The band the strip occupies now reads as part of the header for as long as the
header is what is being described, and releases the moment the pointer is past it,
so the module below is still selectable. On a phone shell the strip keeps the
arrows and the actions and drops the label, which had nowhere to go in 390px.

### "Edit module" lands on the module editor

The button changed step and left the editor at the top of it — which in the
modules step is the brief reader, then the imagery panel, then the page sequence,
with the module editor below the fold and nothing to say the page had moved. It
now travels there: an animated scroll unless motion is switched off, and the panel
marked for a moment on arrival.

### A programmatic edit no longer loses to its own stale markup

Found while the document drop kept coming out empty, and it was not the document
reader. Replacing the editor's markup blurs whatever was focused, a blur on an
edited field is answered with a `change`, and that `change` carries the value the
field held **before** the render. To every handler on the editor that is
indistinguishable from typing — so any programmatic edit that caused a render was
overwritten by its own stale markup a moment later. Nothing that happens during
the swap is a person editing, so nothing during the swap is delivered.

## 2.5.0 — The global parts, and the panels that were too long

### The navigation and the footer step like a module

Hovering a module in the preview has always named its pattern and offered arrows to
walk through the registered alternatives. The two global parts were the one thing on
the page that could not be changed that way — the overlay ignored them on purpose,
with a comment saying neither was "a module anyone can swap".

They are now addressed exactly like a module: the same overlay, the same arrows, the
same left/right keys, one undo per gesture, and the element repainted in place
rather than through a full frame rebuild. What stands in for the pattern is the
layout variant, and each part now has five:

- **Navigation** — Standard (logo left), Centred logo, Stacked (logo over a centred
  menu row), Floating bar (inset, rounded, reads as a panel), and Minimal.
- **Footer** — Editorial statement, Compact utility, Centred closing, Statement
  beside the menus, and Minimal sign-off.

Minimal navigation now does what its name says. It used to hide the desktop links
and show nothing in their place; the burger appears at every width and opens a real
panel of links, driven by the `menu-open` class the header runtime already toggled.

The overlay also carries the phone menu style, because the takeover is the one
navigation decision nobody remembers to go and check: one button cycles Centred →
Left → Right → Aurora, and the preview repaints with it.

Nothing about this is a second source of truth. Both variants are catalogues —
`HEADER_VARIANTS` and `FOOTER_VARIANTS` — read by the editor select, the preview
CSS, the overlay and the exported navigation and footer JSON. Stepping from the
preview moves the select; choosing in the select moves the preview; the export
carries whichever was chosen. An unrecognised variant from an older project or a
style that named one that no longer exists resolves to a real layout on every
ensure pass instead of falling through to unstyled markup.

Because the header's own behaviour — sticky class, announcement dismiss, burger —
was bound once when the document loaded, swapping the element in place would have
left a dead toggle. Those bindings moved into `__sbsBind` as `__sbsBindChrome()`,
idempotent like the rest of it, so the replacement works immediately.

### Buttons that no longer jump away from the cursor

Solid Shift and Pill Glow were the two families that translated the whole button
upward on hover, Pill Glow far enough to read as the button moving out from under
the pointer. Neither travels now: Solid Shift deepens its shadow and keeps its
colour inversion, Pill Glow grows very slightly in place and keeps its glow. Solid
Shift says `transform:none` explicitly, because `dst-shared.css` gives every button
a shared -2px lift that a missing rule would let through.

### A button label you can actually read

Every label colour in the button system was written as white, because the ground
behind a button was assumed to be dark. Across fifty archetypes it is not: a pale
accent — sand, mint, citrus — produced white text on a light fill, and the worst
pair in the library measured **1.09:1**, which is a button with no visible label at
all.

The four DST button tokens and every hard-coded white in the ten families now read
from `--sbs-on-accent` / `--sbs-on-ink`, which the page derives from its own palette
by asking which of white or the page's ink can be read on that fill. Across the 50
styles, label-on-ground pairs below 4.5:1 went from **27 of 150 to 3**, and the
worst case from 1.09:1 to 4.00:1 — the remaining three being the best any colour
can do on those accents without moving the palette the style deliberately chose.
The editor swatches publish the same two tokens, so a family cannot read correctly
in the preview and look broken in the panel.

### The AI writes the footer

Applying AI content rewrote every module and left the closing band on the
demonstration project's statement — the last thing on the page, and the one piece of
copy that was never asked for. The content job now returns a `footer` object with
the closing statement, its supporting sentence and its button label. It is reviewed
in the draft list with the sections, applied with them, and reversed by the same
single undo. The legal line, the menu columns and every link are untouched, because
none of those are copy the brain was asked for.

The footer is optional in the answer and never optional in the result: a model that
skips it gets the deterministic footer, assembled from the strategist's own words
like every other sentence the planner writes. A draft carrying no closing statement
leaves the existing footer alone rather than overwriting it with empty strings.

### Design dials: one sample, two to a row

The live sample was three cards demonstrating the grid gap, which the preview beside
it already shows, at three times the height. It is one card now, still carrying every
token the panel is about — padding, radius, border, shadow, type scale, line height,
reading measure.

"Replay the movement" is gone, along with the automatic replay that fired whenever
the movement dial moved. It re-ran an entrance nobody had asked to see.

The nine dials are paired two to a row. They are short controls — a label, a track,
two words of scale — and one per row was most of the panel's height.

### Saving is a notification, not a readout

The top bar said "Saved locally" permanently, whether or not anything had just been
saved. It is now a pill at the bottom right that says **Saving** while the write is
pending, **Saved** when it lands, and then withdraws. It keeps an `aria-live`
announcement, since nothing in the bar carries the state any more.

Writing the pill turned up a real defect underneath it. Autosave is debounced by
420ms, and nothing flushed it: close the tab, reload, or lock the phone inside that
window and the last edit was gone. A pending save is now written on `pagehide` and
on the page becoming hidden. Two existing reload tests had been passing on the
knife edge of that race and started failing when this release shifted the timing by
a few milliseconds — which is how the defect was found.

### Simple Step 01, condensed

The step asks for one paragraph and then offers five panels of controls, which was a
long scroll past things most briefs never touch. Every panel is a disclosure now.
Four open, and **Button family** starts closed with the chosen family named in its
summary — the concept already picked one, and its ten live samples were the tallest
thing on the step. Navigation and footer stays closed as before.

### Every photograph gets a wash, not two families

Copy over a picture needs something between the two. That existed for `hero` and
`cta`, and an audit of all **154 registered patterns** says the list was the wrong
shape: **19 more patterns paint a photograph behind their copy and painted nothing
over it** — six `team` bands, six `cards`, two `faq`, two `timeline`, a `text` band
and a `testimonial`. Fifteen of the nineteen had *dark* copy, so whether the words
could be read depended entirely on what the photograph happened to be doing behind
them.

The family list is gone. The rule is the condition itself: **a section that paints
a photograph and is not already painting a wash gets one — the brand's own dark at
60%** — and because 60% is the strength at which the wash *is* the ground rather
than a tint, the copy inverts to suit. Both halves matter: darkening the ground
without inverting fifteen bands of dark type would have made them worse.

Three things it deliberately does not do:

- **A pattern that paints its own wash keeps it exactly.** `sbs-hero-p89-v1`'s
  `#240800` at 60%, `p89-v2`'s 27% white tint (a tint, so the photograph stays the
  ground and the copy stays light), `p89-v3`'s pale gradient (which *is* the ground,
  so that band reads dark-on-light) — all untouched.
- **A colour the pattern carries but does not paint is not a wash.** Three of the
  nineteen had an overlay colour with the flag off, which rendered nothing; those
  get the default.
- **It follows the brand.** The wash is the palette's `dark`, so restyling a project
  moves it — otherwise a page restyled from navy to forest keeps a navy scrim over
  every photograph. The colour written is recorded, so the moment anybody edits a
  wash by hand it stops matching and is never moved again.

The `contact` band's own 50% wash went with the list. It was a second convention
for the same job — alpha-carried rather than strength-carried — and weaker than the
banners for no reason anyone had written down. One rule now covers it at the same
60%.

The wash also reaches a photograph that is not on the node the surface control
edits: `sbs-faq-p6-v2` paints its picture on a banner three levels down, and the
old code would have washed the wrong node.

### The overlay no longer covers the navigation it describes

The navigation is 80-odd pixels tall and every one of them is a control — logo,
links, the action, the burger. The overlay's bar, tools and arrows sat straight on
top of them, so hovering the navigation to change it made the burger unclickable.
They now sit in a strip immediately below the bar. The footer keeps the inside
placement: it is tall, has nothing at its top edge, and moving its controls above
it would push them off the stage whenever its top is scrolled past.

### Two defects the timing changes surfaced

Selecting a module is supposed to scroll the preview to it. It scrolled with
`behavior: 'auto'`, which is not "instant" — it defers to the document's own
`scroll-behavior`, and the preview page sets that to `smooth`. So every jump was
animated, including the one taken when movement is switched off, and an animated
scroll is cancellable: re-fitting the frame — which happens on every step change
and every rescale of the shell — cancelled it outright. Select a module within a
beat of switching step and the preview simply stayed where it was. The instant
path now really is instant, and the animated one verifies that it started: if the
frame has not moved at all a moment later, the scroll is made immediately. It only
does that when the position is untouched, so it can never fight a reader who has
scrolled somewhere themselves.

Several specs measured *inside* the preview document while a queued rebuild was
still pending, which replaced the document under them — "Execution context was
destroyed", or a sampling loop's promise garbage-collected. `previewSettled()` in
`tests/browser/support/preview.mjs` waits for the frame's load events to go quiet;
waiting for the frame to *contain* something never was enough, because the
outgoing document contains it too. The same race had a second face: a rebuild also
re-renders the editor, so a field a spec was holding could be detached before it
was typed into, and a colour set on the detached node went nowhere.

### QA

- `tests/browser/global-parts.spec.mjs` — 10 tests: the overlay on both parts, the
  keys walking all five layouts and wrapping, the five compositions measured as
  genuinely different, the minimal navigation's desktop panel opening and closing,
  the phone menu cycling through all four, no footer layout losing its statement,
  menus or legal line, the select and the export agreeing with the overlay, one undo
  per step, the burger still working after the element is swapped, and a module
  still stepping its own pattern.
- `tests/browser/photo-scrim.spec.mjs` — 5 tests: every one of the 154 patterns
  that paints a picture also paints a wash (with the count asserted, so it cannot
  pass by finding nothing), every background-media card keeps its scrim, the wash
  is the brand dark at 60% with the copy inverted, an authored wash survives
  untouched in all three of its forms, and a default wash follows the brand while
  an edited one never moves.
- `tests/browser/global-parts.spec.mjs` — 2 more tests: no overlay control overlaps
  the navigation's own box, and the burger can be clicked while the overlay shows.
- `tests/browser/save-pill.spec.mjs` — placement, both states, the withdrawal, and
  an edit surviving a reload that happens inside the debounce window.
- `tests/browser/button-styles.spec.mjs` — two new tests: no family travels
  vertically on hover, and the worst label/ground contrast across all 50 styles.
- `tests/browser/brief-brain-ui.spec.mjs` — two new tests: the footer drafted,
  reviewed, applied, exported and undone; and a draft with no closing copy leaving
  the footer alone.
- `tests/unit/button-styles.test.mjs`, `tests/unit/brief-planner.test.mjs`,
  `tests/unit/brief-schemas.test.mjs`, `tests/integration/brief-brain-api.test.mjs` —
  nine new tests covering the hover rules, the derived label tokens, the
  deterministic footer, the footer coercion and the server's fallback.
- Every navigation and footer layout rendered through real DST and inspected as
  screenshots.

### Still failing

`tests/browser/legibility.spec.mjs` → "catches a band that really is unreadable"
remains failing for the reason recorded under 2.4.0. It is unrelated to anything in
this release.

## 2.4.0 — The Style Library

### Ten families, fifty production styles

`src/data/style-library.json` now holds 50 style profiles across 10 families —
Technology, Luxury, Editorial, Corporate, Commerce, Hospitality, Automotive /
Mobility, Health / Wellness, Creative / Culture and Experimental — five each, under
stable keys like `creative-culture/art-gallery`. They are authored in
`style-factory/style-seeds.json` and built by `npm run styles:build`.

A concept records the style it resolves from, so an export names it:
`concept.style` carries the family, the style, the version and the variation.

### A style is not a palette preset — and that is enforced

A profile has to take a position on every axis the engine can vary, and choosing one
moves all of them: palette, display and body type, radius and button family; **all
nine Design Dials**; **composition** (alignment, container bias, media dominance,
surface treatment, asymmetry, full-bleed bias); **component recipes per section
family** (container, vertical rhythm, inversion, arrival effect, column counts,
decorative motif); and **pattern preferences**.

The last of those is the point. `compilePatternWeight` scores every candidate
pattern against the style's preferred and avoided terms, so switching from Art
Gallery to Precision SaaS does not recolour the same page — it re-selects the
modules out of the same 154 patterns, carrying the existing copy across. Terms
rather than pattern ids, matched against the profile the ranker already builds from
each catalogue entry, so a preference survives the catalogue growing. A pattern the
strategist picked by hand is locked and never re-selected.

`shared/styles/distinctness.mjs` scores all 1,225 pairs across those axes with
**palette weighted lowest**, and the build refuses a catalogue containing a
near-clone. Three pairs were rejected during authoring — `dark-prestige` against
both `resort-editorial` and `culinary-luxury`, and `technical-grid` against
`technical-automotive` — and were redesigned rather than nudged past the threshold.
A unit test proves the gate works by recolouring one style and asserting it still
reads as a clone.

### The picker, in both builders

Family, then style: Advanced Step 02 and Simple Step 01. The 13 original A–M
archetypes remain as the older, coarser path, and choosing one now clears the
concept's style reference rather than leaving it claiming a style it no longer
follows.

### One style, three concepts

`Generate V1/V2/V3` builds all three from the chosen style so a client compares
interpretations of one design language: **V1 Core** as authored, **V2 Brand-led**
with the client's colours as far as the style's own `brandMapping` allows, **V3
Expressive** pushing the axes the style is already strongest on. The display
typeface never changes between them, and a protected palette role is never taken by
a brand colour — a gallery style whose canvas turns burgundy has stopped being a
gallery style.

Precedence is fixed: style default → variation → brief/brand directives →
concept-specific manual edits, with manual edits last and authoritative.

### The factory

```bash
npm run styles:build      # seeds -> profiles, validate, distinctness, docs, evidence
npm run styles:validate   # the same checks without regenerating documentation
```

Emits the runtime catalogue, `styles/<family>/<style>/{style.json,DESIGN.md}` for all
fifty, `style-factory/STYLE.schema.json` generated from the same constants the
validator uses so the two cannot drift, and
`release-evidence/style-catalog-qa.json` plus `style-distinctness.json`. Structural
checks beyond the schema: five styles per family, unique keys, all nine dials set,
and every component recipe naming a real section family and a real decoration motif.
`style-factory/STYLE-CONSTITUTION.md` defines what every permitted value means.

### Also in this release

The concept row actions on the Review step were four sentences of label inside a
fixed 27px icon square, so they overflowed and printed on top of each other. They
are icons now — open, reset, copy-into — each with an accessible name and a hover
label that stays inside the editor column, held by a browser test that measures
overlap and tooltip bounds.

The typed-outline builder now lists what can be typed into it. "The page will
have…" over an empty box asked the strategist to guess the vocabulary, and a guess
the mapper cannot resolve comes back as an unresolved line. All 19 registered
section families are listed with what each is for, and each is a button that appends
itself to the outline and renumbers the list — so the box can be filled without
typing and without guessing. The list stays open until it is closed on purpose, and
the same family can be added twice, because a page flow is a sequence. The block was
also duplicated in the advanced and simple flow steps; it is now one function used by
both.

### QA

- `tests/unit/style-library.test.mjs` — 31 tests: every profile valid, the named 50
  present under the expected keys, fonts/buttons/motifs/section families all real,
  distinctness including the recolour control, the compiler's variations, brand
  mapping and precedence, pattern weighting and component recipes.
- `tests/browser/style-library.spec.mjs` — 7 tests: the picker in both builders,
  choosing a style changing patterns *and* containers *and* dials *and* palette
  while preserving the copy, three concepts from one style, the export carrying the
  style, a per-concept style surviving a reload, and an archetype clearing it.
- Five gold-standard styles rendered through real DST and inspected as screenshots.

### Known failing test

`tests/browser/legibility.spec.mjs` → "catches a band that really is unreadable" is
failing. It is a negative control: it breaks the palette by hand and expects the
rendered-contrast audit to notice. Making the style's pattern preferences part of
the ranking tie-break changed which patterns that test's page ends up with, and the
bands the audit samples now paint their own grounds, so the broken palette no longer
produces a combination the audit can see. The product behaviour is intact — the
rendered page does reflect the broken palette, and the four other legibility tests
including the positive control across all 13 archetypes still pass. The control
needs to pin its patterns rather than depend on the ranker; it was left failing
rather than weakened to go green.

## 2.3.0 — Three concept workspaces

### V1, V2 and V3 are three independently editable websites

A project now holds exactly three **concept workspaces**, and each one is a
complete website proposal: its own style reference, palette, fonts, all nine
Design Dials, button family, page flow, module sequence, pattern choices, section
content, layout, responsive settings, media placements, navigation, footer, page
metadata, publish state and revision. The brief, the AI brief analysis, the client
identity and the Shutterstock media *pool* stay shared at project level, because
those describe the source material rather than the proposal.

Before this, a concept owned a slice of `project.design` and switching concepts
meant reading values out of the live project and writing them back into the
concept they came from. Anything the capture list did not name — a section, a
pattern choice, a mobile column count — was shared between all three concepts
whether you wanted it to be or not, and anything it named incorrectly was lost.

The replacement is structural rather than procedural. `bindProject` in
`shared/concepts/workspace.mjs` installs accessors on the project for `design`,
`sections`, `header`, `footer`, `flowId`, `page`, `style` and `manualOverrides`,
and every one of them resolves through `conceptSet.activeConceptId` on each read
and each write. Five thousand lines of existing editor code therefore edit the
active concept and nothing else, and there is no moment at which an edit exists on
the project but not yet in a concept. Nothing has to be captured because nothing
was ever detached. `captureConceptEdit` is gone.

### The switcher belongs to the project, not to one builder

The V1/V2/V3 pills now render in Simple **and** Advanced, on every step where a
concept exists, and each pill names the concept it opens rather than a list index.
A pattern swap or a mobile column count set in Advanced is there when you go back
to Simple, because both are editing the same workspace.

### Undo and redo are per concept

Editing V1, switching to V2, editing V2 and pressing undo undoes the V2 change.
Each concept keeps its own stack, an entry carries the shared project state so a
brief edit comes back with the step that made it, and switching concepts is
navigation — it pushes nothing and clears nothing. Typing coalescing was also made
per concept: an 850ms window left open by a slider in one concept used to swallow
the first checkpoint of an edit made in another, leaving that concept with an edit
and no way to undo it.

### Exports name the concept they came from

Every artifact carries `concept.conceptId`, `slot`, `variantType`, `revision`, the
resolved style reference and the nine dial values, and export filenames carry the
slot. Three concepts used to produce three indistinguishable `page.json` files for
the same client, and importing the wrong one was a silent failure. A new
**all-concepts archive** (`data-export="all-concepts"`) writes one ZIP with a
folder per concept, each holding that concept's four artifacts plus a manifest.

### The first flow reaches all three concepts

Three proposals built on three different page structures are not a comparison, so
the first flow chosen applies to every concept that has not been edited yet. A
concept somebody has worked on keeps its own flow, and a later flow change reaches
only the concept on screen. Nothing structural is ever propagated over existing
work.

### Reset and copy, deliberately

The Review step in both builders gains a **Concept workspaces** panel listing each
concept with its design source, variation, module count and revision. From there a
concept can be reset to the workspace it was generated as, or copied over another
slot. Both confirm first, and neither ever copies publish state or a public link.

### Older projects load unchanged

A pre-3.0 project becomes V1 exactly as it was — same sections, same design, same
globals, same ids — with V2 and V3 left empty. Nothing is re-derived, because
re-resolving somebody's approved work against today's defaults would change it. A
2.2.x `project.simple.concepts` set is the one exception: those really were three
design proposals, so their palettes, fonts, buttons and dial nudges are carried
onto the matching slot and a full workspace is built around each.

The session envelope moved to `sbs-builder-v3` and stores the canonical concept
set once, plus which concept was open. The two older keys are still read, so a
returning session migrates on load.

### One flow catalogue, counted once

The data file shipped 20 flows and the runtime pushed 15 more onto the array at
boot — five from `SBS_EXTRA_FLOWS`, ten from `SBS_V3_FLOWS` — while every loaded
project pushed its own typed flows on top of that. So the number of flows in the
product depended on which projects a session had opened, and no two places agreed
on the count: the data file said 20, a unit test asserted 15, the README claimed
30, and the running product had 35. The QA script that produced the "30" figure
scraped one injection block and missed the other.

All 35 flows now live in `src/data/dst-data.json`, which is the whole catalogue.
The runtime injects none, `DATA.flows` is frozen, and a flow a strategist types
stays on their project and is joined in by `allFlows()`. Data, runtime, tests,
QA scripts and README now report the same 35.

### QA

- `npm run qa:concepts` — 24 object-level checks covering migration, generation,
  isolation, lossless switching, storage round-trip, per-concept history and the
  deliberate reset/copy operations. Writes `release-evidence/concept-isolation-qa.json`.
- `tests/unit/concept-workspace.test.mjs` — 29 unit tests on the concept model.
- `tests/browser/simple-builder.spec.mjs` — rewritten to the workspace contract,
  including three concepts diverging in content and structure, repeated round-trips,
  a reload that restores all three, per-concept undo, and exports proving which
  concept they came from.

Two assertions in the browser suite described a product that had already moved on
and were failing before this work started — the flow step offers five
recommendations rather than three, and the Simple review exports the same
artifacts as Advanced rather than one. Both are fixed against what the builder
actually does.

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
