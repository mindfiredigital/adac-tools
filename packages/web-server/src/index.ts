import express from 'express';
import path from 'path';
import cors from 'cors';
import jsYaml from 'js-yaml';
import { generateDiagramSvg } from '@mindfiredigital/adac-diagram';
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';
import { CostCalculator } from '@mindfiredigital/adac-cost';
import type { AdacConfig } from '@mindfiredigital/adac-schema';

const app: express.Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from the 'public' directory
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// Instantiate engines once
const complianceChecker = new ComplianceChecker();
const costCalculator = new CostCalculator();

// ─── API Endpoint — Generate Diagram ────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  try {
    const { content, layout } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }

    const result = await generateDiagramSvg(content, layout);
    res.status(200).json(result);
  } catch (e: unknown) {
    console.error('Generation failed:', e);
    const error = e as Error & { logs?: string[] };
    res.status(500).json({
      error: error.message || 'Internal Server Error',
      logs: error.logs,
    });
  }
});

// ─── API Endpoint — Compliance Check ────────────────────────────────────────
app.post('/api/compliance-check', (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }

    const config = jsYaml.load(content) as AdacConfig;

    if (!config || !config.infrastructure) {
      res
        .status(400)
        .json({ error: 'Invalid ADAC configuration: missing infrastructure' });
      return;
    }

    const result = complianceChecker.checkCompliance(config);
    res.status(200).json(result);
  } catch (e: unknown) {
    console.error('Compliance check failed:', e);
    const error = e as Error;
    res.status(500).json({
      error: error.message || 'Compliance check failed',
    });
  }
});

// ─── API Endpoint — Cost Analysis ───────────────────────────────────────────
app.post('/api/cost', (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }

    const config = jsYaml.load(content) as AdacConfig;

    if (!config || !config.infrastructure) {
      res
        .status(400)
        .json({ error: 'Invalid ADAC configuration: missing infrastructure' });
      return;
    }

    const result = costCalculator.calculate(config);
    res.status(200).json(result);
  } catch (e: unknown) {
    console.error('Cost analysis failed:', e);
    const error = e as Error;
    res.status(500).json({
      error: error.message || 'Cost analysis failed',
    });
  }
});

// Start Server only if run directly (not imported as module)
if (process.argv[1].endsWith('index.js')) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Serving static files from: ${publicPath}`);
  });
}

export default app;
