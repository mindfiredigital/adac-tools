# ADAC - AWS Diagram Generator

ADAC (AWS Diagram As Code) is a comprehensive architecture diagramming tool that offers both a powerful CLI for programmatic generation and a modern Web UI for visual design. It leverages the precision of `elkjs` for graph layout algorithms to produce high-quality SVG diagrams from ADAC-formatted YAML files or visual drag-and-drop interactions.

## 📂 Folder Structure

```
adac_nodejs/
├── bin/                # CLI entry point scripts
│   └── adac-diagram.ts # Main CLI command definition
├── frontend/           # React-based Web Application
│   ├── src/
│   │   ├── components/ # React components (Flow, Sidebar, Uploader, Home)
│   │   └── assets/     # Frontend assets
│   ├── public/         # Static assets served by the web server
│   └── ...
├── src/                # Core application source code
│   ├── buildElkGraph.ts # Logic to transform ADAC model to ELK graph
│   ├── diagram.ts       # Main orchestrator function
│   ├── layoutDagre.ts   # Adapter for Dagre layout engine
│   ├── mappings/        # Icon mapping definitions and assets
│   │   ├── definition.yaml # Raw ADAC definition file
│   │   └── icon-map.json   # Processed icon mapping
│   ├── parseAdac.ts     # YAML parsing logic
│   ├── renderSvg.ts     # SVG rendering engine
│   └── types.ts        # TypeScript type definitions
├── yamls/              # Example and usage YAML input files
├── output_diagrams/    # Directory for generated SVG outputs
├── dist/               # Compiled Backend/CLI JavaScript files
└── package.json        # Project manifest and dependencies
```

## 🛠 Tools & Technologies Used

- **Runtime**: Node.js
- **Frontend**: React, Vite, TailwindCSS, React Flow
- **Backend/CLI**: TypeScript, Express (for serving UI/API)
- **CLI Framework**: [Commander.js](https://github.com/tj/commander.js)
- **Graph Layouts**: 
  - [elkjs](https://github.com/kieler/elkjs) (Eclipse Layout Kernel) - *Default*
  - [dagre](https://github.com/dagrejs/dagre) (Directed Graph Layout)
- **YAML Parser**: [js-yaml](https://github.com/nodeca/js-yaml)

## 🚀 Setup & Installation Guide

### Prerequisites
- Ensure you have **Node.js** (v16+ recommended) installed.

### 1. Clone & Install
Navigate to the project directory and install dependencies:
```bash
npm install
```

### 2. Build the Project
Compile the TypeScript backend and building the React frontend:
```bash
npm run build
```
This processes both the CLI tools (`dist/`) and the Web UI (`frontend/dist` -> `public/`).

### 3. Setup Icons
Run the icon generation script to index available AWS icons for the frontend:
```bash
node generate_icons.js
```

---

## 🖥️ Using the Web Interface (Visual Designer)

The ADAC Web UI provides a modern interface for designing architectures visually or generating diagrams from existing code.

### 1. Start the Server
Start the web application:
```bash
npm start
```
The application will be accessible at **http://localhost:3000**.

### 2. Features

#### 🎨 Visual Designer
- **Drag & Drop**: Select AWS components from the sidebar (organized by category) and drag them onto the infinite canvas.
- **Connect**: Draw lines between nodes to define relationships.
- **View YAML**: Instantly see the ADAC-compliant YAML representation of your visual design.
- **Export**: Generate and download a high-quality SVG image of your architecture.

#### 📤 Upload YAML
- **Quick Generation**: Click "Upload YAML" from the home screen.
- **Direct Preview**: Upload any valid `.yaml` file. The screen will split to show your file details on the left and the generated diagram on the right.
- **Download**: Save the generated result as an SVG.

---

## 💻 Using the CLI (Command Line Interface)

You can generate diagrams programmatically using the built-in CLI tool.

**Syntax:**
```bash
node dist/bin/adac-diagram.js diagram <file> [options]
```

**Options:**
- `-o, --out <path>`: Output SVG file path (default: `diagram.svg`).
- `--layout <engine>`: Layout engine to use (`elk` or `dagre`).

**Examples:**

1. **Default Generation (ELK):**
   ```bash
   node dist/bin/adac-diagram.js diagram yamls/adac_example_webapp.yaml -o output_diagrams/webapp.svg
   ```

2. **Using Dagre Layout:**
   ```bash
   node dist/bin/adac-diagram.js diagram yamls/test_dagre.yaml --layout dagre -o output_diagrams/test_dagre.svg
   ```

## 📊 Layout Engines
| Feature | **ELK (Default)** | **Dagre** |
| :--- | :--- | :--- |
| **Best For** | Complex, deeply nested architectures with many containers. | Simpler, standard directed graphs (flowcharts). |
| **Routing** | Advanced orthogonal routing. | Simple routing. |
| **Alignment** | Port-based alignment. | Rank-based alignment. |
