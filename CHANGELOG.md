# Changelog

All notable changes to the ADAC (Architecture Diagram As Code) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial public release features coming soon
- Declarative layout and styling (global `layoutOptions`, per-element `visual.layout` and `visual.style`, connection `layout` and `bidirectional`, lengths in logical units resolved through `unitSize`). See [docs/DECLARATIVE_LAYOUT.md](https://github.com/mindfiredigital/adac-tools/blob/main/docs/DECLARATIVE_LAYOUT.md).
- Default layout profile for ELK, `layoutOptions.defaults: v1` (default) or `none`; explicit values always win.
- One warning per file from `adac diagram` and `adac validate` when declarative properties are used with the `custom`, `orthogonal` or `tsm` engine; `adac diagram --help` prints the engine support table.
- The legend is kept clear of the diagram; the SVG grows (height up to 120 px, width up to 200 px) when no clear spot exists.

### Changed

- License changed from ISC to MIT for all packages
- Improved package.json structure across all 23 packages
- Enhanced commit message validation with package scopes
- Azure layout containers now emit renamed CSS classes together with legacy aliases; consumers should migrate to `azure-vnet`, `azure-subscription`, and `azure-subnet`.
- Breaking (0.x minor): the `dagre` layout engine is removed; `layout: dagre` and `--layout dagre` fail with `Unsupported layout engine`; use `elk` (default) or `custom`.
- Containers without declared padding are more compact (side and bottom padding 40 px to 30 px, top stays 60 px); `layoutOptions.defaults: none` restores the old padding.
- Edge ends on short sides are spaced differently, parallel edge runs are separated differently, `maxItemsPerLine` balances lines (7 items with a maximum of 3 become 3+2+2), and `minSize` no longer overwrites the size the builder computed.
- `adac diagram` prints every `Warning:` log line to stderr (exit codes unchanged) and `adac validate` prints all validator warnings; every ELK run logs one `Layout defaults applied:` line.
- Packaging: AWS icons are now in the separate package `@mindfiredigital/adac-icons-aws`; install it next to `@mindfiredigital/adac-diagram` to get icons. GCP and Azure diagrams are drawn without icons in this release. The package declares no `@mindfiredigital/*` dependencies, ships self-contained type declarations and no sourcemaps, and requires Node 20 or newer.

### Fixed

- Fixed handlebars version vulnerability (CVE GHSA-2w6w-674q-4c4q)

### Deprecated

- Non-standard commit types removed from commitlint configuration

### Removed

- Removed ISC license references

### Security

- Added pnpm audit checks in CI/CD pipeline
- Upgraded vulnerable dependencies

## [0.1.0] - 2026-01-15

### Added

- Initial monorepo setup with 23 packages
- Core diagram generation engine
- CLI interface for ADAC
- Multiple layout engines (ELK and Custom)
- AWS, GCP, and Azure icon support
- Compliance framework validation (PCI-DSS, SOC2, HIPAA)
- Cost analysis capabilities
- Export to Terraform, Kubernetes, CloudFormation
- Web UI for visual diagram creation
- VS Code extension

### Changed

- Improved documentation across all packages

### Fixed

- Various bug fixes and improvements

## Per-Package Changelogs

Individual package changelogs are maintained in:

- `packages/*/CHANGELOG.md`

For detailed changes in specific packages, refer to:

- [adac-core CHANGELOG](packages/core/CHANGELOG.md)
- [adac-diagram CHANGELOG](packages/diagram/CHANGELOG.md)
- [adac-parser CHANGELOG](packages/parser/CHANGELOG.md)
- [adac-validator CHANGELOG](packages/validator/CHANGELOG.md)
- [adac-compliance CHANGELOG](packages/compliance/CHANGELOG.md)
- [adac-cost CHANGELOG](packages/cost/CHANGELOG.md)
- [adac-layout-elk CHANGELOG](packages/layout-elk/CHANGELOG.md)

- [adac-web CHANGELOG](packages/web/CHANGELOG.md)
- [adac-web-server CHANGELOG](packages/web-server/CHANGELOG.md)

---

**Changelog maintained by:** ADAC Team
**Last Updated:** 2026-04-15
