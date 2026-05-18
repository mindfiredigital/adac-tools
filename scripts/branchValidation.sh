#!/bin/bash
# Branch naming validation script
# Enforces branch naming conventions for the monorepo

BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
VALID_BRANCH_REGEX="^(feature|fix|chore|refactor|docs|test|ci|release|hotfix)\/[a-z0-9\-]{3,}$|^(main|dev)$"

if ! [[ $BRANCH_NAME =~ $VALID_BRANCH_REGEX ]]; then
  echo "❌ Invalid branch name: $BRANCH_NAME"
  echo "Branch names must follow one of these patterns:"
  echo "  - feature/<description>"
  echo "  - fix/<description>"
  echo "  - chore/<description>"
  echo "  - refactor/<description>"
  echo "  - docs/<description>"
  echo "  - test/<description>"
  echo "  - ci/<description>"
  echo "  - release/<version>"
  echo "  - hotfix/<issue>"
  echo "  - main"
  echo "  - dev"
  echo ""
  echo "Example: feature/add-new-export-format"
  exit 1
fi

exit 0
