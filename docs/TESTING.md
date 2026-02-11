# ADAC Tools - Local Package Testing Guide

## Overview

This guide provides strategies for testing ADAC Tools packages locally, aligning with Issue #6.

## 1. Unit Testing

We use [Vitest](https://vitest.dev/) for unit testing.
Run all tests from root:

```bash
pnpm test
```

Or for a specific package:

```bash
cd packages/parser
pnpm test
```

## 2. Dependency Verification

Ensure all packages build correctly in dependency order:

```bash
pnpm -r build
```

## 3. CLI Testing

Test the CLI executable:

```bash
node packages/cli/dist/index.js --help
```

Test diagram generation:

```bash
node packages/cli/dist/index.js diagram ./yamls/example.yaml -o output.svg
```

## 4. Visual Testing

Use the `web` frontend to visualize diagrams:

```bash
cd packages/web
pnpm dev
```

Navigate to `http://localhost:5173`.

## 5. API Testing

Start the backend server:

```bash
node packages/web-server/dist/index.js
```

Generate via API:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"content": "..."}'
```
