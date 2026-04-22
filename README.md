# ADAC - Architecture Diagram As Code

[![npm version](https://img.shields.io/npm/v/@mindfiredigital/adac-diagram)](https://www.npmjs.com/package/@mindfiredigital/adac-diagram)
[![CI Status](https://img.shields.io/github/actions/workflow/status/mindfiredigital/adac-tools/ci.yml)](https://github.com/mindfiredigital/adac-tools/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Monorepo managed with pnpm](https://img.shields.io/badge/managed%20with-pnpm-blue)](https://pnpm.io)

ADAC is a comprehensive ecosystem for generating high-quality multi-cloud architecture diagrams (currently supporting AWS and GCP). It provides a powerful command-line interface (CLI), a developer-friendly core engine, and a modern Web UI for both programmatic and visual diagram creation.

## 📂 Project Overview & Structure

The project is managed as a **pnpm monorepo**, ensuring modularity and clean separation of concerns.

### 📦 Packages

| Package                                  | Description                     | Key Responsibilities                                                                |
| :--------------------------------------- | :------------------------------ | :---------------------------------------------------------------------------------- |
| **`@mindfiredigital/adac-core`**         | The brain of the system.        | Orchestrates parsing, validation, compliance, **optimization**, and rendering.      |
| **`@mindfiredigital/adac-diagram`**      | Distribution package for users. | Provides the `adac` CLI and a public API for web applications.                      |
| **`@mindfiredigital/adac-cli`**          | CLI Engine.                     | Handles command-line arguments and help text. Separated from the diagram logic.     |
| **`@mindfiredigital/adac-parser`**       | YAML Logic.                     | Robust parsing of ADAC-formatted YAML files into structured data.                   |
| **`@mindfiredigital/adac-schema`**       | Validation Layer.               | Formally defines the ADAC specification using JSON Schema.                          |
| **`@mindfiredigital/adac-layout-elk`**   | Professional Layout.            | Advanced graph positioning using `elkjs` algorithms.                                |
| **`@mindfiredigital/adac-layout-dagre`** | Simple Layout.                  | Lightweight alternative for hierarchical graph layouts.                             |
| **`@mindfiredigital/adac-icons-aws`**    | AWS Assets.                     | Repository of over 1,600 AWS icons and tools to manage them.                        |
| **`@mindfiredigital/adac-icons-gcp`**    | GCP Assets.                     | Repository of GCP icons mapping to Google Cloud services.                           |
| **`@mindfiredigital/adac-compliance`**   | Validation & Security.          | Evaluates architecture against security frameworks (PCI-DSS, SOC2, HIPAA, etc).     |
| **`@mindfiredigital/adac-cost`**         | Analysis Tool.                  | Evaluates cloud architecture to provide structural cost breakdowns.                 |
| **`@mindfiredigital/adac-optimizer`**    | **Architecture Optimizer.**     | Automatic cost, security & reliability recommendations on every diagram run.        |
| **`@mindfiredigital/adac-web`**          | Frontend.                       | React-based visual editor with drag-and-drop and real-time preview.                 |
| **`@mindfiredigital/adac-web-server`**   | API.                            | Express server exposing diagram generation, optimization & compliance as a service. |

---

## 🚀 Local Setup

### Prerequisites

- **Node.js**: v20 or newer.
- **pnpm**: v9 or newer (`npm install -g pnpm`).

### Installation Steps

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/mindfiredigital/adac-tools.git
    cd adac-tools
    ```
2.  **Install All Dependencies**:
    ```bash
    pnpm install
    ```
3.  **Bootstrap Packages**:
    Compile the entire workspace to ensure all internal modules are linked:
    ```bash
    pnpm run build
    ```

---

## 🛠 Usage & Package Deep Dive

### 1. The `adac` CLI (`@mindfiredigital/adac-diagram`)

The CLI is the primary way to use ADAC programmatically.

- **Generate a Diagram** (optimizer runs automatically and prints a summary to stdout):

  ```bash
  pnpm cli diagram my-infra.yaml -o output.svg
  ```

  _(Compliance declarations on individual services are checked and reflected in SVG tooltips. Architecture optimization recommendations are printed to the console.)_

- **Generate without optimizer analysis**:

  ```bash
  pnpm cli diagram my-infra.yaml -o output.svg --no-optimize
  ```

- **Schema Validation Only**:
  ```bash
  pnpm cli validate my-infra.yaml
  ```

### 2. Core Engine (`@mindfiredigital/adac-core`)

Use this package if you are building your own application that needs to generate diagrams.

```typescript
import { generateDiagramSvg } from '@mindfiredigital/adac-core';

// Optimizer runs automatically — results available in optimizationResult
const { svg, logs, optimizationResult } = await generateDiagramSvg(
  yamlContent,
  'elk'
);

if (optimizationResult) {
  console.log(
    `${optimizationResult.summary.total} optimization recommendations`
  );
  console.log(`${optimizationResult.summary.critical} critical`);
}

// Skip optimizer
const { svg: svgOnly } = await generateDiagramSvg(
  yamlContent,
  'elk',
  false,
  undefined,
  'monthly',
  true
);
```

### 3. Web UI (`@mindfiredigital/adac-web`)

To run the visual editor:

```bash
cd packages/web
pnpm dev
```

---

## 📦 Dependencies & Architecture Patterns

### Critical Patterns

- **Zero-Dependency Releases**: When `core` or `diagram` are built, they bundle all internal workspace dependencies (like `parser` and `layout`). This ensures that users installing via npm don't need to worry about internal mono-repo layout.
- **Embedded Assets**: Diagrams generated by ADAC embed icons directly as **Base64 URI** data. This makes the output SVG files fully portable—they will render correctly anywhere without needing access to an external image folder.

### Key Third Party Libs

- **elkjs**: High-performance graph layout engine.
- **commander**: CLI argument parsing.
- **commander**: React Flow (for the visual editor).
- **ajv**: JSON Schema validation.

---

## 📜 Monorepo Scripts

| Command             | Action                                                                                                        |
| :------------------ | :------------------------------------------------------------------------------------------------------------ |
| `pnpm build`        | Compiles all packages in the workspace in topological order.                                                  |
| `pnpm test`         | Runs the test suite across all packages.                                                                      |
| `pnpm cli`          | Runs the ADAC CLI directly from the source.                                                                   |
| `pnpm setup:icons`  | Generates/downloads cloud provider icons (runs `setup-icons` in icon packages).                               |
| `pnpm release:pack` | **Important**: Creates standalone `.tgz` release tarballs for `core` and `diagram` in the `releases/` folder. |
| `pnpm format`       | Runs Prettier across the entire codebase.                                                                     |

---

## 📑 Special Folders & Files

When cloning this repo, pay attention to:

- **`/releases`**: Destination for standalone npm packages generated by `release:pack`. (Ignored by git).
- **`/yamls`**: Contains real-world example infrastructure files (`aws.adac.yaml`, `gcp.adac.yaml`, `data_pipeline.adac.yaml`) used for testing.
- **`/scripts`**:
  - `pack-release.js`: The automation engine for creating production builds.
  - `generate-report.ts`: A tool that generates `report.html` to visually compare different layout engines.
- **`pnpm-workspace.yaml`**: Defines how the packages are linked during development.

---

## 🎓 Summary of Requirements Met

1.  **Core** is a bundleable npm package.
2.  **Core** uses `schema` for validation and `parser` for parsing.
3.  **Core** supports both `elk` and `dagre` layout strategies.
4.  **CLI** is decoupled into its own package for clean command management.
5.  **Diagram** provides both a CLI entry point and an npm module API.
6.  **Web Server** consumes the `diagram` package as a standard npm module.
7.  **Optimizer** runs automatically on every diagram generation (CLI, VS Code, npm module, web server) and can be disabled with `--no-optimize` / `skipOptimizer: true` / `"adac.diagram.optimize": false`.
8.  **Web Server** compresses all API responses (gzip/brotli) for token and bandwidth efficiency.

---

## 🤝 Contributing

We welcome contributions from the community! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for:

- How to set up your development environment
- Branch naming conventions
- Commit message guidelines
- Testing requirements
- Pull request process

### Quick Start for Contributors

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/adac-tools.git
cd adac-tools

# Install dependencies and build
pnpm install && pnpm build

# Create a feature branch
git checkout -b feature/your-feature

# Make your changes and test
pnpm lint && pnpm format && pnpm test

# Push and create a PR
git push origin feature/your-feature
```

---

## 📋 Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md) that we expect all community members to follow. Please read it to understand our community standards and reporting procedures.

---

## 📚 Additional Resources

- [API Reference](docs/API_REFERENCE.md) - Detailed API documentation
- [Code Quality Guidelines](docs/CODE_QUALITY.md) - Standards and best practices
- [Testing Strategy](docs/TESTING.md) - Testing approach and coverage targets
- [GitHub Discussions](https://github.com/mindfiredigital/adac-tools/discussions) - Ask questions and share ideas

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with ❤️ by the Mindfire team and our amazing community contributors.
