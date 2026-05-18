# CONTRIBUTING

Thank you for your interest in contributing to ADAC! This document provides guidelines and instructions for contributing to our monorepo.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Guidelines](#commit-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Release Process](#release-process)

## Code of Conduct

All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- **Node.js**: v20 or newer
- **pnpm**: v9 or newer (`npm install -g pnpm`)
- **Git**: v2.30 or newer

### Local Setup

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/adac-tools.git
   cd adac-tools
   ```

3. Add the upstream repository:

   ```bash
   git remote add upstream https://github.com/mindfiredigital/adac-tools.git
   ```

4. Install dependencies:

   ```bash
   pnpm install
   ```

5. Build all packages:

   ```bash
   pnpm run build
   ```

6. Run tests:
   ```bash
   pnpm run test
   ```

## Development Workflow

### Create a Feature Branch

```bash
# Fetch latest from upstream
git fetch upstream

# Create a feature branch from dev
git checkout upstream/dev -b feature/your-feature-name
```

### Branch Naming Convention

Use one of these prefixes for your branch name:

- `feature/` - New features
- `fix/` - Bug fixes
- `chore/` - Maintenance tasks
- `refactor/` - Code improvements
- `docs/` - Documentation updates
- `test/` - Test improvements
- `ci/` - CI/CD related changes
- `release/` - Release branches (version number)
- `hotfix/` - Critical production fixes

**Examples:**

- `feature/add-gcp-export`
- `fix/parsing-edge-case`
- `docs/update-api-reference`

### Make Changes

1. Work on your feature/fix in the relevant package(s) under `packages/`
2. Run linting and formatting:

   ```bash
   pnpm lint
   pnpm format
   ```

3. Run tests:

   ```bash
   pnpm test
   ```

4. Rebuild all packages:
   ```bash
   pnpm build
   ```

## Commit Guidelines

We follow **Conventional Commits** format. Each commit message consists of a **header**, **body**, and **footer**.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect code logic (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without feature changes
- **perf**: Code changes that improve performance
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI/CD configuration
- **chore**: Other changes that don't modify src or test files

### Scope

The scope must be a **package name** without the `@mindfiredigital/` prefix:

- `adac-core`
- `adac-parser`
- `adac-schema`
- `adac-layout`
- `adac-layout-elk`
- `adac-layout-dagre`
- `adac-layout-core`
- `adac-icons-aws`
- `adac-icons-gcp`
- `adac-icons-azure`
- `adac-compliance`
- `adac-cost`
- `adac-cli`
- `adac-diagram`
- `adac-web`
- `adac-web-server`
- `adac-export-terraform`
- `adac-export-k8s`
- `adac-export-cloudformation`
- `adac-doc`
- `adac-templates`
- `adac-optimizer`

### Subject

- Use the **imperative mood** ("add feature" not "added feature")
- Do not capitalize the first letter
- Do not add a period (.) at the end
- Limit to 50 characters
- Use lowercase

### Body (Optional)

- Explain _what_ and _why_, not _how_
- Wrap at 72 characters
- Separate from subject with a blank line
- Use bullet points for multiple changes

### Footer (Optional)

- Reference related issues: `Closes #123`, `Fixes #456`
- Note breaking changes: `BREAKING CHANGE: description`

### Examples

```
feat(adac-parser): add support for new compliance framework

Add parsing logic for CIS benchmark compliance framework.
Implements validation rules and error handling for malformed
CIS configuration sections.

Closes #89
```

```
fix(adac-layout-elk): correct node spacing calculation

Previously, nodes were overlapping when graph width exceeded 1000px.
Updated spacing algorithm to account for node dimensions.

Fixes #234
```

## Testing

### Running Tests

```bash
# Run all tests once
pnpm test

# Run with coverage
pnpm test:coverage

# Run tests in watch mode (for development)
pnpm test -- --watch

# Run tests for a specific package
pnpm --filter @mindfiredigital/adac-core test
```

### Writing Tests

- Collocate test files with source code: `src/parser.ts` → `src/parser.test.ts`
- Use descriptive test names
- Follow the **Arrange-Act-Assert** pattern
- Mock external dependencies
- Aim for >80% code coverage

Example test:

```typescript
import { describe, it, expect } from 'vitest';
import { parseYaml } from './parser';

describe('parseYaml', () => {
  it('should parse valid YAML content', () => {
    // Arrange
    const yaml = 'services:\n  api: {name: api-server}';

    // Act
    const result = parseYaml(yaml);

    // Assert
    expect(result.services.api.name).toBe('api-server');
  });
});
```

## Documentation

- Update `README.md` files in affected packages
- Update root `README.md` if scope changes
- Update API documentation in `docs/API_REFERENCE.md`
- Add JSDoc comments for public APIs
- Include examples in documentation

## Pull Request Process

1. **Before creating a PR:**
   - Ensure your branch is up-to-date with `upstream/dev`
   - Verify all tests pass locally
   - Run linting and formatting

2. **Create a PR:**
   - Use a descriptive title following commit conventions
   - Fill out the PR template completely
   - Reference related issues

3. **PR Review:**
   - Address review comments promptly
   - Don't force-push without discussion
   - Keep commits organized (use `git rebase` if needed)

4. **Merging:**
   - Requires approval from at least one maintainer
   - CI must pass
   - All conversations must be resolved

## Code Style

### TypeScript

- Use `.ts` or `.tsx` for all source files
- Strict mode enabled (`"strict": true` in tsconfig.json)
- Use semantic variable/function names
- Prefer `const` over `let`, avoid `var`

### Formatting

Use Prettier (auto-formatted on save):

```bash
pnpm format     # Format all files
pnpm format:check  # Check formatting
```

### Linting

Use ESLint to catch issues:

```bash
pnpm lint       # Check linting
pnpm lint:fix   # Auto-fix linting issues
```

## Release Process

Maintainers handle releases. The process:

1. Merge all changes to `main` branch
2. Maintainer runs release script:
   ```bash
   pnpm release:publish
   ```
3. Automatically publishes to npm and GitHub Packages

## Getting Help

- **Questions?** Open a [Discussion](https://github.com/mindfiredigital/adac-tools/discussions)
- **Bug Reports?** Open a [Bug Report Issue](https://github.com/mindfiredigital/adac-tools/issues/new?template=bug_report.md)
- **Features?** Open a [Feature Request Issue](https://github.com/mindfiredigital/adac-tools/issues/new?template=feature_request.md)

## Recognition

Thanks for contributing! Your efforts help make ADAC better for everyone.

---

**Happy coding! 🎉**
