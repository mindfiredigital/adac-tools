import express from 'express';
import path from 'path';
import cors from 'cors';
import { generateDiagramSvg } from '@mindfiredigital/adac-diagram';

const app: express.Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from the 'public' directory
// We are in dist/index.js, so public is probably in process.cwd()/public
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// API Endpoint
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

// Start Server only if run directly (not imported as module)
// if (require.main === module) { // This works in Node.js CJS
if (process.argv[1].endsWith('index.js')) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Serving static files from: ${publicPath}`);
  });
}

export default app;
