# @mindfiredigital/adac-vscode

**ADAC - Architecture Diagram as Code** VS Code Extension

Full IDE support for `.adac.yaml` files with syntax highlighting, IntelliSense, real-time validation, diagram preview, and code snippets.

## Features

### 🎨 Syntax Highlighting

- ADAC-specific keywords highlighted (services, providers, connections, compliance frameworks)
- Color-coded service types, cloud providers, and environments
- Comment support with `#`

### 🧠 IntelliSense (Autocomplete)

- **Context-aware completions** for services, connection types, protocols, regions, and more
- **90+ AWS services** and **20+ GCP services** with descriptions
- **Cross-reference completion** for `from`/`to` fields in connections (shows all known IDs)
- **Application ID completion** in `runs` arrays
- Top-level ADAC structure scaffolding

### ✅ Inline Validation

- **Real-time YAML syntax checking**
- **ADAC structure validation** (required fields, valid enums)
- **Unique ID enforcement** across the entire file
- **Connection reference validation** (warns about unknown `from`/`to` IDs)
- Configurable: on-type (debounced), on-save, or manual

### 🔍 Hover Tooltips

- **Service info** on hover (official name, provider, category, description)
- **Connection type descriptions** explaining each connection type
- **Compliance framework details** (PCI-DSS, HIPAA, GDPR, SOC2, etc.)
- **ID reference tracking** showing where an ID is referenced

### 📊 Diagram Preview

- Live **architecture diagram preview** in a webview panel
- Auto-updates as you edit the YAML
- Color-coded nodes by service category
- Interactive tooltips on hover
- Connection arrows with protocol labels
- Service statistics summary

### 📝 Code Snippets

| Prefix             | Description                     |
| ------------------ | ------------------------------- |
| `adac-scaffold`    | Complete ADAC file scaffold     |
| `adac-aws-service` | AWS service block               |
| `adac-gcp-service` | GCP service block               |
| `adac-connection`  | Connection definition           |
| `adac-application` | Application definition          |
| `adac-aws-cloud`   | AWS cloud configuration         |
| `adac-vpc`         | VPC with public/private subnets |
| `adac-ecs-fargate` | ECS Fargate service             |
| `adac-rds`         | RDS database instance           |
| `adac-cost`        | Cost configuration              |
| `adac-monitoring`  | Monitoring configuration        |
| `adac-metadata`    | Metadata section                |

### ⚡ Commands

| Command                       | Description                       |
| ----------------------------- | --------------------------------- |
| `ADAC: Validate Current File` | Run full validation with summary  |
| `ADAC: Preview Diagram`       | Open architecture diagram preview |
| `ADAC: Format Document`       | Format YAML with consistent style |

## Configuration

| Setting                     | Default | Description                     |
| --------------------------- | ------- | ------------------------------- |
| `adac.validation.enabled`   | `true`  | Enable real-time validation     |
| `adac.validation.onSave`    | `true`  | Validate on file save           |
| `adac.validation.onType`    | `true`  | Validate as you type            |
| `adac.diagram.theme`        | `auto`  | Diagram theme (auto/light/dark) |
| `adac.diagram.layoutEngine` | `elk`   | Layout engine (elk/dagre)       |

## Getting Started

1. Install the extension
2. Open or create a `.adac.yaml` file
3. Start typing — IntelliSense will guide you

Use the `adac-scaffold` snippet to create a complete ADAC file template:

```yaml
version: '0.1'

metadata:
  name: 'My Architecture'
  author: 'Author'
  description: 'Architecture description'
  created: '2026-01-01'

applications:
  - id: 'my-app'
    name: 'My Application'
    type: frontend
    technology: 'React'

infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: aws
      region: 'us-east-1'
      services:
        - id: 'my-service'
          service: ecs-fargate
          name: 'My Service'

connections:
  - id: 'app-to-service'
    from: 'my-app'
    to: 'my-service'
    type: api-call
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Watch mode
pnpm run watch

# Package
pnpm run package
```

## License

MIT
