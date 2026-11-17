---
'@mindfiredigital/adac-core': minor
'@mindfiredigital/adac-diagram': minor
'@mindfiredigital/adac-validator': minor
---

Warn when declarative layout properties (`layoutOptions`, `visual.layout`, connection `layout` / `bidirectional`) are used with the `custom`, `orthogonal` or `tsm` engine, which ignore them: one warning per file from `adac diagram` and `adac validate`, plus an engine support matrix in `--help` and `docs/DECLARATIVE_LAYOUT.md`.

Add a trialled default profile for `layoutOptions` you leave out on `elk`. **Visible change:** at the default `unitSize: 100`, diagrams without declared container padding render slightly more compact (container side padding 40px → 30px, mean canvas area −2.8% over the sample corpus, no new overlaps). The padding is in logical units, so with another `unitSize` it scales with it (a larger one makes containers bigger, not more compact); the default top padding never goes below 60px, so container titles keep their band. Explicit values always win; set `layoutOptions.defaults: none` to keep the previous layout. See `docs/DECLARATIVE_LAYOUT.md` ("Defaults").
