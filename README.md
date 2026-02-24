# ADAC - AWS Diagram Generator

ADAC (AWS Diagram As Code) is a comprehensive architecture diagramming tool that offers both a powerful CLI for programmatic generation and a modern Web UI for visual design. It leverages the precision of `elkjs` for graph layout algorithms to produce high-quality SVG diagrams from ADAC-formatted YAML files or visual drag-and-drop interactions.

## 📂 Folder Structure

The project is organized as a monorepo using pnpm workspaces:

```
adac_nodejs/
├── packages/
│   ├── diagram/            # Core Diagram Logic & CLI (@mindfiredigital/adac-diagram)
│   ├── layout-elk/         # ELK Layout Logic
│   ├── layout-dagre/       # Dagre Layout Logic
│   ├── icons-aws/          # AWS Icons and utility scripts
│   ├── parser/             # YAML Parsing Logic
│   ├── schema/             # Schema Definitions & Validation Logic (@mindfiredigital/adac-schema)
│   └── ...                 # Other utility packages
├── yamls/                  # Example YAML input files
└── ...
```

## 🛠 Tools & Technologies

- **Runtime**: Node.js (v20+ recommended)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Frontend**: React, Vite, TailwindCSS, React Flow (in `packages/web`)
- **CLI**: Commander.js (in `packages/diagram`)
- **Graph Layouts**: `elkjs` (default), `dagre`

## 🚀 Setup & Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or newer)
- [pnpm](https://pnpm.io/) (Install via `npm install -g pnpm`)

### Installation

1. Clone the repository.
2. Install dependencies from the root directory:

```bash
pnpm install
```

3. Build all packages:

```bash
pnpm run build
```

This will compile TypeScript code across all packages.

### Running Tests

To verify that all packages are working correctly, run the test suite:

```bash
pnpm test
```

This executes Jest/Vitest tests across the monorepo to ensure functionality.

## 🖥️ Web Application

To start the web interface in development mode:

1. Navigate to the web package:
   ```bash
   cd packages/web
   ```
2. Start the development server:
   ```bash
   pnpm dev
   ```
3. Open your browser and navigate to the local URL (usually `http://localhost:5173`).

## 💻 CLI Usage

You can use the CLI to generate diagrams programmatically.

To run the CLI from source (after building):

```bash
pnpm cli --help
# Or directly:
node packages/diagram/dist/cli.js --help
```

### Example Usage

Generate a diagram from a YAML file:

```bash
pnpm cli diagram yamls/aws.adac.yaml -o output.svg
```

### Options


- `-o, --out <path>`: Output SVG file path (default: `diagram.svg`).
- `--layout <engine>`: Layout engine to use (`elk` or `dagre`).
- `--validate`: Validate strict adherence to ADAC schema before generation.

### Schema Validation

You can validate your ADAC YAML files against the official specification without generating a diagram:

```bash
pnpm cli validate yamls/my-architecture.yaml
```

Or enforce validation during diagram generation:

```bash
pnpm cli diagram yamls/my-architecture.yaml --validate
```

## 🎨 Icons Setup

If icons are missing or need updating, you can run the setup script from the root:

```bash
pnpm setup:icons
```
