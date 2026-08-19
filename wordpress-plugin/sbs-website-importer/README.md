# SBS Website Importer

A Digital Silk–specific WordPress importer for the SBS Page Builder.

## What it imports

- `page.json` into an existing or new WordPress page as native Gutenberg block comments.
- `navigation.json` into a native WordPress menu and a Header `wp_template_part`.
- `footer.json` into an editable Footer `wp_template_part`.
- A complete project ZIP containing `navigation.json`, `footer.json`, `page.json`, and `website.html`.

`website.html` is never inserted into WordPress. It is included only for standalone review.

## Requirements

- WordPress 6.4 or newer.
- PHP 8.0 or newer.
- A block theme for Header/Footer template parts to be active on the front end.
- The Digital Silk theme/block package that registers the exported `ds-blocks/*` blocks.
- No PHP Zip extension is required. The importer uses `ZipArchive` when available and falls back to WordPress's bundled PclZip reader.

## Installation

1. Upload `sbs-website-importer.zip` through **Plugins → Add New → Upload Plugin**.
2. Activate **SBS Website Importer**.
3. Open **SBS Importer** in the WordPress admin menu.
4. Upload the complete project ZIP or an individual JSON artifact.
5. Review the detected artifacts and choose their destinations.
6. Import and open the resulting page, Header, or Footer directly from the success screen.

## Editable block options

The importer preserves each block's original registered name, attributes, and child hierarchy. The Gutenberg editor therefore loads the same Digital Silk inspector controls for containers, spacing, overlays, responsive columns, card direction, effects, media, and other registered block properties.

The importer does not re-register or imitate the Digital Silk blocks. If the Digital Silk block package is inactive, WordPress will mark those blocks as missing until it is activated.

## Security

- Capability and nonce checks on every action.
- ZIP path traversal protection.
- Entry count and uncompressed-size limits.
- JSON validation.
- Sanitized `core/html` content.
- Allowlisted design-token CSS values; external `url()` and executable CSS are rejected.
- Optional media sideloading through WordPress APIs with source URL deduplication.

## Header and Footer location

Header and Footer imports are saved as `wp_template_part` records in the active theme's `header` and `footer` areas. In a block theme they are available from **Appearance → Editor → Design → Patterns**. The default slugs are `header` and `footer`, which lets themes that reference those standard slugs use the imported parts immediately.

## Complete project bundle

The plugin accepts the browser-generated four-file project ZIP. It uses `ZipArchive` when available and WordPress's bundled PclZip reader as a fallback. Duplicate artifact filenames, unsafe paths, oversized entries, and malformed JSON are rejected.
