import express from 'express';
import path from 'path';
import cors from 'cors';
import compression from 'compression';

import {
  generateDiagramHandler,
  complianceCheckHandler,
  costAnalysisHandler,
  optimizeHandler,
} from './handlers';

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

// ─── API: Generate Diagram ────────────────────────────────────────────────────
app.post('/api/generate', generateDiagramHandler);

// ─── API: Compliance Check ────────────────────────────────────────────────────
app.post('/api/compliance-check', complianceCheckHandler);

// ─── API: Cost Analysis ───────────────────────────────────────────────────────
app.post('/api/cost', costAnalysisHandler);

// ─── API: Optimize ────────────────────────────────────────────────────────────
app.post('/api/optimize', optimizeHandler);

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
if (
  process.argv[1].match(/index\.(js|ts)$/) &&
  process.env.NODE_ENV !== 'test'
) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Serving static files from: ${publicPath}`);
  });
}

export default app;
