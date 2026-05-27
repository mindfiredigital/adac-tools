# Introduction

Welcome to **ADAC Tools** – Architecture Diagram As Code. This monorepo provides a suite of packages that let you define, validate, visualize, and manage cloud architectures using a simple YAML‑based language.

- **Core packages**: `adac-core-schema`, `adac-parser`, `adac-validator` – define the schema and validate your models.
- **Diagram generation**: `adac-diagram` renders SVG/PNG diagrams with layout engines (ELK, Dagre).
- **CLI orchestrator**: `adac-cli` ties everything together, offering commands for generation, validation, cost estimation, compliance checks, and more.
- **Cost & compliance**: `adac-cost`, `adac-compliance` provide cloud cost estimates and compliance rule checks.
- **Export & tooling**: Exporters to Terraform, CloudFormation, Kubernetes, plus a VS Code extension and a visual web editor.

The documentation site you are viewing is generated from these markdown files and provides usage examples, API references, and guides to get started.

---

# Installation

## Prerequisites

- **Node.js** (>= 18) and **pnpm** (recommended) installed.
- **Git** for cloning the repository.

## Install the whole monorepo

```bash
# Clone the repository
git clone https://github.com/mindfiredigital/adac-tools.git
cd adac-tools

# Install dependencies using pnpm (will install all packages)
pnpm install
```

## Install a specific package

If you only need a single package, you can install it directly from npm:

```bash
# Example: install the CLI package
pnpm add -g @mindfiredigital/adac-cli
```

Or locally within the monorepo workspace:

```bash
pnpm add @mindfiredigital/adac-diagram
```

## Verify installation

```bash
adac --help   # should display the CLI help menu
```

---

For more detailed usage, refer to the individual package docs (e.g., `docs/cli.md`, `docs/diagram.md`).
