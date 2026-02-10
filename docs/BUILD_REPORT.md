# ADAC Monorepo Build Status

## Overview
Successfully verified build for all core packages in the ADAC monorepo.

## Verified Packages (Built Successfully)

| Package | Path | Dependencies | Status |
|---|---|---|---|
| `@mindfiredigital/adac-schema` | `packages/schema` | (None) | ✅ Built |
| `@mindfiredigital/adac-layout-core` | `packages/layout-core` | `schema` | ✅ Built |
| `@mindfiredigital/adac-parser` | `packages/parser` | `schema`, `js-yaml` | ✅ Built |
| `@mindfiredigital/adac-layout-elk` | `packages/layout-elk` | `layout-core`, `schema`, `elkjs` | ✅ Built |
| `@mindfiredigital/adac-layout-dagre` | `packages/layout-dagre` | `layout-core`, `layout-elk`, `dagre` | ✅ Built |
| `@mindfiredigital/adac-diagram` | `packages/diagram` | `schema`, `parser`, `layout-elk`, `layout-dagre`, `elkjs` | ✅ Built |
| `@mindfiredigital/adac-cli` | `packages/cli` | `commander`, `diagram`, `parser`, `schema`, `layout-*` | ✅ Built |
| `@mindfiredigital/adac-web-server` | `packages/web-server` | `express`, `diagram` | ✅ Built |
| `@mindfiredigital/adac-web` | `packages/web` | `react`, `schema`, `parser`, `diagram` | ✅ Built |
| `@mindfiredigital/adac-icons-aws` | `packages/icons-aws` | (None/Scripts) | ✅ Setup |

## Key Changes
- Moved `generate.ts`, `batchGenerate.ts` to `packages/diagram`.
- Moved `elkBuilder.ts` to `packages/layout-elk`.
- Moved `svgRenderer.ts` to `packages/diagram`.
- Moved `dagreAdapter.ts` to `packages/layout-dagre`.
- Moved `adac-diagram.ts` to `packages/cli/src/index.ts`.
- Migrated `server.ts` to `packages/web-server`.
- Fixed all circular dependencies and type errors across packages.

## How to Build

Run from root:
```bash
pnpm install
pnpm -r build
```

## How to Run

### CLI
```bash
node packages/cli/dist/index.js --help
```

### Web Server (API)
```bash
node packages/web-server/dist/index.js
```

### Web Frontend
```bash
cd packages/web
pnpm dev
```
