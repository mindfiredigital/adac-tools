import express from 'express';
import path from 'path';
import cors from 'cors';
import compression from 'compression';
import jsYaml from 'js-yaml';
import { generateDiagramSvg } from '@mindfiredigital/adac-diagram';
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';
import {
  CostCalculator,
  mapAdacServicesToCostConfig,
} from '@mindfiredigital/adac-cost';
import { analyzeOptimizations } from '@mindfiredigital/adac-optimizer';
import type { AdacConfig } from '@mindfiredigital/adac-schema';

const app: express.Application = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
// Compress all responses (gzip / deflate / brotli) to save tokens over the wire
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(compression() as any);
app.use(express.json({ limit: '10mb' }));

// Serve static files from the 'public' directory
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// ─── Singleton engines ────────────────────────────────────────────────────────
const complianceChecker = new ComplianceChecker();
const costCalculator = new CostCalculator();

// ─── Helper: parse YAML and validate base structure ──────────────────────────
function parseAdacConfig(content: string): AdacConfig {
  const config = jsYaml.load(content) as AdacConfig;
  if (!config || !config.infrastructure) {
    throw new Error('Invalid ADAC configuration: missing infrastructure');
  }
  return config;
}

// ─── API: Generate Diagram ────────────────────────────────────────────────────
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

// ─── API: Compliance Check ────────────────────────────────────────────────────
app.post('/api/compliance-check', (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }

    const config = parseAdacConfig(content);
    const result = complianceChecker.checkCompliance(config);
    res.status(200).json(result);
  } catch (e: unknown) {
    console.error('Compliance check failed:', e);
    const error = e as Error;
    const isValidationError = error.message?.includes(
      'Invalid ADAC configuration'
    );
    res.status(isValidationError ? 400 : 500).json({
      error: error.message || 'Compliance check failed',
    });
  }
});

// ─── API: Cost Analysis ───────────────────────────────────────────────────────
app.post('/api/cost', (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }

    const config = parseAdacConfig(content);
    const services =
      config.infrastructure.clouds?.flatMap((cloud) => cloud.services ?? []) ??
      [];
    const costConfig = mapAdacServicesToCostConfig(services);
    const result = costCalculator.calculate(costConfig);
    res.status(200).json(result);
  } catch (e: unknown) {
    console.error('Cost analysis failed:', e);
    const error = e as Error;
    const isValidationError = error.message?.includes(
      'Invalid ADAC configuration'
    );
    res.status(isValidationError ? 400 : 500).json({
      error: error.message || 'Cost analysis failed',
    });
  }
});

// ─── API: Optimize ────────────────────────────────────────────────────────────
/**
 * POST /api/optimize
 *
 * Request body:
 *   content  – ADAC YAML string (required)
 *   options  – OptimizerOptions (optional)
 *     categories        – string[]  (cost|security|reliability|architecture|…)
 *     minSeverity       – string    (critical|high|medium|low|info)
 *     enableCostRules       – boolean
 *     enableSecurityRules   – boolean
 *     enableReliabilityRules – boolean
 *
 * Response: OptimizationResult (compressed)
 */
app.post('/api/optimize', (req, res) => {
  try {
    const { content, options } = req.body as {
      content?: string;
      options?: Record<string, unknown>;
    };

    if (!content) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }

    const config = parseAdacConfig(content);
    const result = analyzeOptimizations(
      config,
      options as Parameters<typeof analyzeOptimizations>[1]
    );
    res.status(200).json(result);
  } catch (e: unknown) {
    console.error('Optimization analysis failed:', e);
    const error = e as Error;
    const isValidationError = error.message?.includes(
      'Invalid ADAC configuration'
    );
    res.status(isValidationError ? 400 : 500).json({
      error: error.message || 'Optimization analysis failed',
    });
  }
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction
  ) => {
    console.error(`[${new Date().toISOString()}] Unhandled error:`, err);
    console.error(`Request: ${req.method} ${req.path}`);

    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
);

// ─── Start Server ─────────────────────────────────────────────────────────────
if (process.argv[1].match(/index\.(js|ts)$/)) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Serving static files from: ${publicPath}`);
  });
}

export default app;
