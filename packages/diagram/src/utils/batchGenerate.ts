import fs from 'fs-extra';
import path from 'path';
import { generateDiagram } from '../core/generate.js';

async function main() {
  const yamlsDir = path.resolve(process.cwd(), 'yamls');
  const outDir = path.resolve(process.cwd(), 'output_diagrams');
  
  await fs.ensureDir(outDir);
  
  const files = await fs.readdir(yamlsDir);
  const reports: { file: string; engine: string; status: 'success' | 'failure'; time: number; error?: string }[] = [];
  
  for (const file of files) {
    if (!file.endsWith('.yaml')) continue;
    
    console.log(`Processing ${file}...`);
    const inputPath = path.join(yamlsDir, file);
    const baseName = path.basename(file, path.extname(file)).replace('.adac', '');
    
    // Test ELK
    const elkOut = path.join(outDir, `${baseName}_elk.svg`);
    const startElk = Date.now();
    try {
        await generateDiagram(inputPath, elkOut, 'elk');
        reports.push({ file, engine: 'elk', status: 'success', time: Date.now() - startElk });
        console.log(`  ELK: Success`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ELK: Failed`, msg);
        reports.push({ file, engine: 'elk', status: 'failure', time: Date.now() - startElk, error: msg });
    }

    // Test Dagre
    const dagreOut = path.join(outDir, `${baseName}_dagre.svg`);
    const startDagre = Date.now();
    try {
        await generateDiagram(inputPath, dagreOut, 'dagre');
        reports.push({ file, engine: 'dagre', status: 'success', time: Date.now() - startDagre });
        console.log(`  Dagre: Success`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  Dagre: Failed`, msg);
        reports.push({ file, engine: 'dagre', status: 'failure', time: Date.now() - startDagre, error: msg });
    }
  }
  
  // Generate HTML
  let html = `<!DOCTYPE html>
<html>
<head>
    <title>ADAC Diagram Prevention</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        .diagram { margin-bottom: 40px; border: 1px solid #ccc; padding: 10px; }
        .diagram h3 { margin-top: 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .status-success { color: green; }
        .status-failure { color: red; }
        img { max-width: 100%; height: auto; border: 1px dashed #eee; }
        .error { background: #fee; color: #c00; padding: 10px; white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>ADAC Diagram Verification</h1>
    <table>
        <tr><th>File</th><th>Engine</th><th>Status</th><th>Time (ms)</th></tr>
        ${reports.map(r => `<tr>
            <td>${r.file}</td>
            <td>${r.engine}</td>
            <td class="status-${r.status}">${r.status}</td>
            <td>${r.time}</td>
        </tr>`).join('')}
    </table>
    
    <h2>Previews</h2>
    <div class="grid">
  `;
  
  const distinctFiles = [...new Set(reports.map(r => r.file))];
  
  for (const file of distinctFiles) {
      const baseName = path.basename(file, path.extname(file)).replace('.adac', '');
      const elkReport = reports.find(r => r.file === file && r.engine === 'elk');
      const dagreReport = reports.find(r => r.file === file && r.engine === 'dagre');
      
      html += `
        <div class="diagram">
            <h3>${file} (ELK)</h3>
            ${elkReport?.status === 'success' 
                ? `<img src="${baseName}_elk.svg" alt="ELK Diagram" />` 
                : `<div class="error">${elkReport?.error}</div>`}
        </div>
        <div class="diagram">
            <h3>${file} (Dagre)</h3>
            ${dagreReport?.status === 'success' 
                ? `<img src="${baseName}_dagre.svg" alt="Dagre Diagram" />` 
                : `<div class="error">${dagreReport?.error}</div>`}
        </div>
      `;
  }
  
  html += `</div></body></html>`;
  await fs.writeFile(path.join(outDir, 'index.html'), html);
  console.log(`Generated report at ${path.join(outDir, 'index.html')}`);
}

main().catch(console.error);
