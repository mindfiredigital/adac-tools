---
'@mindfiredigital/adac-diagram': minor
---

- Added: declarative layout and styling (global `layoutOptions`, per-element `visual.layout` and `visual.style`, connection `layout` and `bidirectional`, lengths in logical units resolved through `unitSize`). See https://github.com/mindfiredigital/adac-tools/blob/main/docs/DECLARATIVE_LAYOUT.md
- Added: default layout profile for ELK, `layoutOptions.defaults: v1` (default) or `none`; explicit values always win.
- Added: one warning per file from `adac diagram` and `adac validate` when declarative properties are used with the `custom`, `orthogonal` or `tsm` engine; `adac diagram --help` prints the engine support table.
- Added: the legend is kept clear of the diagram; the SVG grows (height up to 120 px, width up to 200 px) when no clear spot exists.
- Breaking (0.x minor): the `dagre` layout engine is removed; `layout: dagre` and `--layout dagre` fail with `Unsupported layout engine`; use `elk` (default) or `custom`.
- Changed: containers without declared padding are more compact (side and bottom padding 40 px to 30 px, top stays 60 px); `layoutOptions.defaults: none` restores the old padding.
- Changed: edge ends on short sides are spaced differently, parallel edge runs are separated differently, `maxItemsPerLine` balances lines (7 items with a maximum of 3 become 3+2+2), and `minSize` no longer overwrites the size the builder computed.
- Changed: `adac diagram` prints every `Warning:` log line to stderr (exit codes unchanged) and `adac validate` prints all validator warnings; every ELK run logs one `Layout defaults applied:` line.
- Packaging: AWS icons are now in the separate package `@mindfiredigital/adac-icons-aws`; install it next to `@mindfiredigital/adac-diagram` to get icons. GCP and Azure diagrams are drawn without icons in this release. The package declares no `@mindfiredigital/*` dependencies, ships self-contained type declarations and no sourcemaps, and requires Node 20 or newer.
