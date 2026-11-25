---
'@mindfiredigital/adac-core': minor
---

First release built from this repository; the 0.1.0 on npm was an earlier package with a different structure.

- Added: declarative layout and styling (global `layoutOptions`, per-element `visual.layout` and `visual.style`, connection `layout` and `bidirectional`, lengths in logical units resolved through `unitSize`). See https://github.com/mindfiredigital/adac-tools/blob/main/docs/DECLARATIVE_LAYOUT.md
- Added: one warning per file from `adac diagram` and `adac validate` when declarative properties are used with the `custom`, `orthogonal` or `tsm` engine; `adac diagram --help` prints the engine support table.
- `@mindfiredigital/adac-validator` is now a dependency.
- AWS icons come from the optional `@mindfiredigital/adac-icons-aws`.
- Requires Node 20 or newer.
