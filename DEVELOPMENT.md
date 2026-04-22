# Development Guide

A comprehensive guide for developers working on the ADAC project.

## Quick Start

```bash
# Clone and setup
git clone https://github.com/mindfiredigital/adac-tools.git
cd adac-tools

# Install and build
pnpm install
pnpm run build

# Run tests
pnpm test

# Start development
pnpm run dev  # or work on specific package
```

## Project Structure

```
adac-tools/
├── packages/           # Individual packages
│   ├── core/          # Main orchestration engine (includes optimizer)
│   ├── parser/        # YAML parsing
│   ├── schema/        # Validation schemas
│   ├── layout-*/      # Layout engines
│   ├── icons-*/       # Cloud provider icons
│   ├── compliance/    # Security framework validation
│   ├── cost/          # Cost analysis
│   ├── optimizer/     # Architecture optimization rules ← NEW
│   ├── cli/           # Command-line interface
│   ├── diagram/       # Distribution package + CLI binary
│   ├── web/           # React UI
│   ├── web-server/    # Express API (compression + /api/optimize)
│   └── vscode/        # VS Code extension
├── docs/              # Documentation
├── scripts/           # Utilities and release scripts
├── .github/           # GitHub configurations
└── README.md          # Project overview
```

## Common Development Tasks

### Run All Tests

```bash
pnpm test              # Run once
pnpm test --watch      # Watch mode
pnpm test:coverage     # With coverage report
```

### Lint and Format

```bash
pnpm lint              # Check ESLint
pnpm lint:fix          # Auto-fix
pnpm format            # Format with Prettier
pnpm format:check      # Check formatting
```

### Build Packages

```bash
pnpm build             # Build all packages
pnpm build -- --filter @mindfiredigital/adac-core  # Single package
```

### Work on Specific Package

```bash
cd packages/core
pnpm dev               # Start dev server (if applicable)
pnpm test --watch      # Watch tests
pnpm build             # Build this package
```

### Generate Diagram

```bash
# Optimizer runs automatically and prints summary to stdout
pnpm cli diagram path/to/architecture.adac.yaml -o output.svg

# Disable optimizer
pnpm cli diagram path/to/architecture.adac.yaml --no-optimize -o output.svg
```

### Run Optimizer standalone

```typescript
import { analyzeOptimizations } from '@mindfiredigital/adac-optimizer';
import { parseAdac } from '@mindfiredigital/adac-parser';

const config = parseAdac('architecture.adac.yaml');
const result = analyzeOptimizations(config, { minSeverity: 'high' });

console.log(`${result.summary.critical} critical, ${result.summary.high} high`);
result.recommendations.forEach((r) =>
  console.log(`[${r.severity}] ${r.title}: ${r.affectedResources.join(', ')}`)
);
```

### Run Web UI

```bash
cd packages/web
pnpm install
pnpm dev               # Usually http://localhost:5173
```

### Run Web Server

```bash
cd packages/web-server
pnpm install
pnpm build
pnpm start             # Usually http://localhost:3000
```

## Git Workflow

### Create Feature Branch

```bash
# Get latest from upstream
git fetch upstream dev
git checkout upstream/dev -b feature/your-feature

# Create and push
git add .
git commit -m "feat(adac-core): description of change"
git push origin feature/your-feature
```

### Commit Message Format

Use **Conventional Commits**:

```
type(scope): subject

body (optional)

footer (optional)
```

**Example:**

```
feat(adac-parser): add support for YAML aliases

Add parsing support for YAML aliases and anchors
to enable complex architecture definitions.

Closes #123
```

### Push and Create PR

1. Push your branch to your fork
2. Go to GitHub and create a pull request
3. Fill out the PR template
4. Wait for CI to pass and reviews

## Testing

### Write Tests

Tests are co-located with source code:

```
src/
├── parser.ts
└── parser.test.ts    # Test file
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { parseYaml } from './parser';

describe('Parser', () => {
  it('should parse valid YAML', () => {
    const result = parseYaml('key: value');
    expect(result).toEqual({ key: 'value' });
  });

  it('should throw on invalid YAML', () => {
    expect(() => parseYaml('invalid: : :')).toThrow();
  });
});
```

### Coverage Requirements

- Minimum 70% line coverage
- Minimum 70% function coverage
- Minimum 65% branch coverage

## Debugging

### Debug Tests

```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs run path/to/test.ts
```

Then open `chrome://inspect` in Chrome DevTools.

### Debug CLI

```bash
node --inspect-brk packages/diagram/dist/cli.js diagram test.yaml
```

### Check Dependencies

```bash
# List all dependencies
pnpm list

# Check for circular dependencies
pnpm dlx depcheck

# View dependency tree
pnpm list --depth=5
```

## Common Issues

### "Module not found" errors

```bash
# Rebuild all packages
pnpm build

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Tests fail locally but pass in CI

```bash
# Run tests exactly like CI
pnpm test:coverage      # With coverage thresholds
```

### Port already in use

```bash
# Kill process using port 3000 (or other port)
lsof -i :3000
kill -9 <PID>
```

## Release Process

Releases are handled by maintainers:

```bash
# Create a release branch
git checkout -b release/v0.2.0

# Bump versions (future: use changesets)
# Update CHANGELOG.md
# Commit and push

# GitHub Actions will:
# 1. Run full test suite
# 2. Build packages
# 3. Publish to npm
# 4. Create release assets
```

## Performance Profiling

### Build Performance

```bash
# Analyze build time
time pnpm build

# Profile specific package
time pnpm --filter @mindfiredigital/adac-core build
```

### Runtime Performance

Use Chrome DevTools or Node profiler:

```bash
node --prof packages/diagram/dist/cli.js diagram huge-diagram.yaml
node --prof-process isolate-*.log > profile.txt
```

## Documentation

### Update API Documentation

Docs are in `docs/` directory:

```bash
# Generate docs from JSDoc
npm install -g typedoc
typedoc packages/*/src/index.ts --out docs/api
```

### Update README

- Root: `/README.md`
- Per-package: `/packages/*/README.md`
- Contributing: `/CONTRIBUTING.md`

## Tools & Resources

- **Editor**: VS Code recommended
- **Extensions**: ESLint, Prettier, Vitest
- **Node**: v20 or v22
- **pnpm**: v9 or newer

## Getting Help

- **Questions**: Use GitHub Discussions
- **Bugs**: Open an issue
- **Chat**: Discord (if available)
- **Docs**: See README.md and /docs

---

Happy coding! 🚀
