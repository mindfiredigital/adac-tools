---
'@mindfiredigital/adac-core': minor
'@mindfiredigital/adac-diagram': minor
---

Add declarative layout and styling properties (ADAC 0.2): global `layoutOptions`, per-element `visual.layout` / `visual.style`, and connection `layout` / `bidirectional`. Layout is hierarchical (each container arranges its direct children) with documented inheritance, logical units resolved through `unitSize`, deprecated `unit` / `routing` aliases, and a `background` setting that defaults to off. See `docs/DECLARATIVE_LAYOUT.md`.
