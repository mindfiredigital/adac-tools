# Changelog

All notable changes to the ADAC (Architecture Diagram As Code) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial public release features coming soon

### Changed

- License changed from ISC to MIT for all packages
- Improved package.json structure across all 23 packages
- Enhanced commit message validation with package scopes

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
- Multiple layout engines (ELK and Dagre)
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
- [adac-schema CHANGELOG](packages/schema/CHANGELOG.md)
- [adac-compliance CHANGELOG](packages/compliance/CHANGELOG.md)
- [adac-cost CHANGELOG](packages/cost/CHANGELOG.md)
- [adac-layout-elk CHANGELOG](packages/layout-elk/CHANGELOG.md)
- [adac-layout-dagre CHANGELOG](packages/layout-dagre/CHANGELOG.md)
- [adac-web CHANGELOG](packages/web/CHANGELOG.md)
- [adac-web-server CHANGELOG](packages/web-server/CHANGELOG.md)

---

**Changelog maintained by:** ADAC Team
**Last Updated:** 2026-04-15
