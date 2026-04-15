# @mindfiredigital/adac-cli

CLI command parser for ADAC diagram generation. Provides command-line interface utilities.

## Features

- 🎯 Commander.js integration
- 📝 Command parsing and validation
- 💬 Help text generation
- ⚙️ Configuration handling

## Installation

```bash
npm install @mindfiredigital/adac-cli
pnpm add @mindfiredigital/adac-cli
```

## Usage

```typescript
import { createAdacCommand } from '@mindfiredigital/adac-cli';

const program = createAdacCommand();
program.parse(process.argv);
```

## Commands

CLI provides commands for:

- Generating diagrams
- Validating YAML
- Checking compliance
- Estimating costs

See [@mindfiredigital/adac-diagram](../diagram) for the main CLI tool.

## See Also

- [@mindfiredigital/adac-diagram](../diagram) - Main CLI distribution
- [@mindfiredigital/adac-core](../core) - Core engine

## License

MIT
