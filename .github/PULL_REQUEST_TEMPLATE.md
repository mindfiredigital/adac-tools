## Pull Request Title

**Provide a brief title that describes your changes (e.g., "Add feature X" or "Fix issue #123").**

---

## Description

### What does this PR do?

_Provide a concise summary of your changes and what issue or feature they address._

### Related Issues

_Link any related issue(s) with references to help reviewers understand the context._

- Closes #ISSUE_NUMBER (if applicable)

## Type of Change

- [x] 🐛 Bug fix
- [ ] 🚀 New feature
- [ ] 📄 Documentation update
- [ ] ⚙️ Code refactoring
- [ ] 🔧 Configuration or CI/CD change
- [ ] 🧹 Maintenance or dependency update

## Commit Message Format

For this **21-package monorepo**, use conventional commits with the package scope:

- `feat(adac-core): add new layout engine` - New feature in a specific package
- `fix(adac-parser): handle edge case in YAML parsing`
- `docs(adac-cli): update usage examples`
- `test(adac-diagram): add integration tests`

**Scope should match the package name from `/packages/*` (without `@mindfiredigital/` prefix).**

## Checklist

_Please ensure the following have been completed before submitting:_

- [ ] I have linted my code using `pnpm lint`.
- [ ] I have formatted my code using `pnpm format`.
- [ ] I have updated the documentation as needed.
- [ ] I have added or updated tests for the changes in this PR.
- [ ] I have included a scope in my commit message matching a package name.
- [ ] All tests pass locally with `pnpm test`.

## Screenshots (if applicable)

_Provide screenshots or GIFs if this PR changes the UI or has visible results._

## Additional Context

_Include any other context, references, or information that may be useful for the reviewers._

---

### Thank you for your contribution!

_We appreciate your efforts in making this project better._
