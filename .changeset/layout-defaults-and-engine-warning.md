---
'@mindfiredigital/adac-core': minor
'@mindfiredigital/adac-diagram': minor
---

Warn when declarative layout properties (`layoutOptions`, `visual.layout`, connection `layout` / `bidirectional`) are used with the `custom`, `orthogonal` or `tsm` engine, which ignore them: one warning per file from `adac diagram` and `adac validate`, plus an engine support matrix in `--help` and `docs/DECLARATIVE_LAYOUT.md`.

Add a trialled default profile for `layoutOptions` you leave out on `elk`. **Visible change:** diagrams without declared container padding render slightly more compact (container side padding 40px → 30px, mean canvas area −2.8% over the sample corpus, no new overlaps). Explicit values always win; set `layoutOptions.defaults: none` to keep the previous layout. See `docs/DECLARATIVE_LAYOUT.md` ("Defaults").
