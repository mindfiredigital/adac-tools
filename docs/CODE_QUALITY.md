# Code Quality & Git Hooks Setup

## ✅ Configured Tools

### ESLint

- **Config**: `.eslintrc.json`
- **Extensions**: `.ts`, `.tsx`
- **Ignores**: `dist/`, `node_modules/`
- **Commands**:
  ```bash
  pnpm lint        # Check for issues
  pnpm lint:fix    # Auto-fix issues
  ```

### Prettier

- **Config**: `.prettierrc`
- **Ignore**: `.prettierignore`
- **Settings**:
  - Semicolons: `true`
  - Single quotes: `true`
  - Trailing commas: `es5`
- **Commands**:
  ```bash
  pnpm format        # Format all files
  pnpm format:check  # Check formatting (used in pre-commit)
  ```

### Husky Git Hooks

#### Pre-commit Hook

Runs before every commit:

- ✓ ESLint checks (`pnpm lint`)
- ✓ Prettier format validation (`pnpm format:check`)

#### Commit-msg Hook

Validates commit message format. **Only allows**:

- `feat: <message>` - New features
- `fix: <message>` - Bug fixes
- `patch: <message>` - Small patches/updates
- `doc: <message>` - Documentation changes

**Examples of valid commits**:

```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve memory leak in parser"
git commit -m "doc: update API reference"
git commit -m "patch: update dependency versions"
```

**Examples of invalid commits** (will be rejected):

```bash
git commit -m "Added new feature"  # ❌ Missing prefix
git commit -m "chore: update deps" # ❌ 'chore' not allowed
git commit -m "Feat: new feature"  # ❌ Uppercase not allowed
```

## Setup Verification

To verify the setup is working:

```bash
# Test linting
pnpm lint

# Test formatting
pnpm format:check

# Test commit message validation (will fail with invalid message)
git commit --allow-empty -m "test: invalid prefix"  # Should fail
git commit --allow-empty -m "feat: valid message"   # Should pass
```

## Configuration Files

- `.eslintrc.json` - ESLint rules
- `.prettierrc` - Prettier formatting rules
- `.prettierignore` - Files to skip during formatting
- `commitlint.config.cjs` - Commit message rules
- `.husky/pre-commit` - Pre-commit hook script
- `.husky/commit-msg` - Commit message validation hook
