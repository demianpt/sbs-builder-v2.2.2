# SBS Page Builder

Two builders over one project model. A **simple builder** turns one paragraph of
brief into three complete design concepts a strategist can show a client in ten
minutes; an **advanced builder** imports that concept and gives you 154
registered patterns, nine design dials, five button families and every
registered DST attribute, then exports the same WordPress importer artifacts from either builder.

## Fast start

```bash
npm install
npm run dev
```

Open the Vite URL printed in Terminal, normally `http://127.0.0.1:5173`.

`npm run dev` starts both processes: the Vite client on `:5173` and the Brief
Brain server on `:4174`. The client proxies `/api` to the server. Running only
`npm run dev:client` leaves the AI features unavailable — the built-in planner
answers instead, and the editor says so.

On macOS you can also double-click `START-MAC.command`. The launcher installs packages when needed, starts the application, and opens the builder.

## WordPress handoff

The final step provides:

- `navigation.json`
- `footer.json`
- `page.json`
- standalone `website.html`
- a **Complete project bundle ZIP** containing all four files

The WordPress plugin source is in:

```text
wordpress-plugin/sbs-website-importer/
```

A ready-to-upload plugin ZIP is included in:

```text
deliverables/sbs-website-importer.zip
```

Install it through **Plugins → Add New → Upload Plugin**, activate it, then open **SBS Importer** in WordPress. Upload either the complete project ZIP or an individual JSON artifact.

The importer can:

- create a new page or replace/append to an existing page;
- import page modules as native Digital Silk Gutenberg block comments;
- create a WordPress navigation menu and editable Header template part;
- create an editable Footer template part;
- apply exported DST design tokens in the front end and block editor;
- optionally copy supported remote images into the WordPress Media Library.

The Digital Silk theme/block package must be active so the imported `ds-blocks/*` blocks expose their native Gutenberg inspector options.

See [`WORDPRESS-IMPORTER-QUICKSTART.md`](WORDPRESS-IMPORTER-QUICKSTART.md).

## DST editing model

Each SBS module keeps its registered block tree and pattern provenance. Module controls cover, where supported by the selected block:

- containers and side padding;
- desktop, tablet, and mobile columns;
- responsive gaps and spans;
- horizontal/vertical card orientation;
- backgrounds, media, overlays, blur, and blend modes;
- alignment and responsive alignment;
- borders, radius, shadows, motion, and decorations;
- all remaining registered settings through the advanced block inspector.

The JSON export is the source of truth for WordPress import. The standalone HTML is for visual review only.

## Two builders

The switch is in the top bar and the whole chrome follows it — sidebar heading,
step list and accent colour all state which builder you are in.

| | Simple builder | Advanced builder |
| --- | --- | --- |
| Steps | 4 | 5 |
| Brief | One textarea | Nine individual fields |
| Direction | Three AI-designed concepts, switchable at any step, plus all nine Design Dials | Archetype grid, nine dials, five button families |
| Page flow | The five best flows for the brief | The recommendations plus the full 30-flow library |
| Modules | Basic view, three tabs | Basic **and** Extended view, plus the DST tree |
| Export | Page, navigation, footer, standalone HTML, project ZIP, optional concept JSON | Page, navigation, footer, standalone HTML, project ZIP |

### The intended journey

1. **Simple builder.** Write one paragraph. The brain reads it and designs three
   concepts — archetype, palette, type, all nine dials and a button family each.
   Pick one of five recommended flows, let the brain write the copy, and export the same WordPress-ready artifacts as Advanced (plus an optional concept JSON).
2. **Show the client.** The V1/V2/V3 pills float over the live preview at every
   step, so all three options are one click away for the whole conversation.
3. **Advanced builder.** Import that JSON in Step 01. The page, navigation,
   footer, design and every edit come across, and the paragraph is split into the
   nine brief fields so every later AI job has what it needs.

### Concepts are only a design

A concept resolves to the design slice and nothing else — see
`CONCEPT_DESIGN_KEYS` in `shared/design/concepts.mjs`. That is what makes the
pills safe: switching V1/V2/V3 after you have chosen a flow, rewritten the copy
and edited a module changes the look and leaves all of that work untouched. A
design edit made while a concept is selected is recorded *on that concept*, so
previewing another and coming back keeps it.

## The AI Brief Brain

One model (`OLLAMA_MODEL`, by default `gemma4:31b` on Ollama Cloud) performs
three jobs, all driven by the Step 01 brief:

| Job | Endpoint | What it does |
| --- | --- | --- |
| Understand | `POST /api/brief/understand` | Reads the brief back field by field, then recommends one DST visual archetype and the five best page flows, with a reason for each |
| Write | `POST /api/brief/content` | Drafts the copy for every section in the current flow |
| Plan | `POST /api/brief/outline` | Maps a typed page outline ("1. Hero 2. Before after image gallery 3. A pricing") onto registered DST section families |
| Design | `POST /api/brief/concepts` | The simple builder's first step: reads one paragraph and returns three complete concepts plus the five best flows |
| Split | `POST /api/brief/expand` | Splits that paragraph into the advanced builder's nine brief fields, for the import |

Three rules hold across every Brief Brain job:

1. **The model never invents structure.** It chooses only from the archetype
   keys, flow ids and section families this server sends it, and every answer is
   validated against a schema in `shared/brief/schemas.mjs` before it can reach a
   project. Anything off-contract is discarded.
2. **The model never invents facts.** Where a section structurally needs a number
   or a name, the draft contains an instruction to replace it, not a plausible
   figure.
3. **The editor is never blocked on inference.** Every job has a deterministic
   twin in `shared/brief/planner.mjs`. If the model is unconfigured, unreachable,
   slow or off-contract, the planner answers and the UI labels the result as
   coming from the built-in planner rather than the model.

The Simple builder exposes those same nine Design Dials directly, so strategists can make global changes without switching to Advanced.

A concept names a *quick style* and may nudge individual dials from there, rather
than inventing nine raw numbers. The model picks a named mood far more reliably
than a coherent set of integers, and the result stays inspectable and editable
after the handoff. Three concepts that share an archetype are rejected outright:
one option shown three times is not a choice.

The hosted model does not reliably honour Ollama's `format` constraint, so each
prompt carries an explicit output example and each schema has a `coerce*`
function that repairs the flattened, renamed shapes the model actually returns.
That repair layer is covered by `tests/unit/brief-schemas.test.mjs`.

Configuration lives in `.env` (see `.env.example`). The API key is server-side
only and never reaches the browser; `publicConfig()` in `server/config.mjs` is
the entire browser-facing surface.

## Design system controls

**Step 02** owns the whole visual system:

- **13 DST visual archetypes** set the starting palette and type pairing.
- **Five button families** — Solid Shift, Sweep Fill, Offset Block, Pill Glow and
  Magnetic Arrow — each define the primary action, the secondary action and the
  text link together, with their own hover behaviour. Defined once in
  `shared/design/button-styles.mjs` and used by the editor swatches, the live
  preview and the theme export, so a swatch cannot drift from the page.
- **Five quick styles** set all nine dials at once.
- **Nine design dials** in `shared/design/dials.mjs`: Density, Reading width,
  Headline size, Brand colour emphasis, Surface definition, Corner softness,
  Image presence, Movement and Expression. Each dial owns a set of CSS custom
  properties *and* a discrete band (for example `data-motion-level="still"`),
  because a purely continuous value is not noticeable enough to feel like a
  control. Movement at 0 switches motion off completely.

Every dial is written into the WordPress theme export (`theme.designDials`,
`theme.layout`, `theme.typography`, `theme.motion`), so an imported page keeps
the rhythm the preview showed.

## Module editor views

**Step 04** opens in **Basic view**: background, content width, space above and
below, how many items per row, how the section arrives, and the registered
decorative motif — in plain language, with nothing that can break a layout.
**Extended view** exposes every registered DST attribute the builder can set,
including per-breakpoint columns, gaps, card and list geometry, overlays and
scroll-driven effects. The choice persists per user.

## Tests

The handoff-specific checks do not require a browser or a WordPress installation:

```bash
npm run test:handoff
```

They verify:

- the browser-generated project ZIP contains the four exact artifacts;
- the artifacts contain valid JSON/HTML;
- page JSON serializes to native Gutenberg block comments;
- navigation receives a WordPress menu ID;
- footer shorthand expands into editable DST blocks;
- all 154 pattern trees can be serialized;
- design-token CSS contains no external `url()` values.

### Everything else

```bash
npm test              # unit, integration and security
npm run test:browser  # Playwright, the full editor
npm run test:all      # both
```

The normal project commands remain:

```bash
npm run build
npm test
npm run test:browser
```

Install Playwright Chromium once when browser tests are needed:

```bash
npx playwright install chromium
```

Do **not** run `npm run migrate:legacy`; it can overwrite the maintained separated source files.
