import fs from 'fs-extra';
import path from 'path';
import { generateDiagramSvg } from '../packages/core/src/index.js';

// Define paths
const YAMLS_DIR = path.join(process.cwd(), 'yamls');
const OUTPUT_FILE = path.join(process.cwd(), 'report.html');

interface ReportEntry {
  file: string;
  dagre: {
    time: number;
    svg: string;
    success: boolean;
    error?: string;
  };
  elk: {
    time: number;
    svg: string;
    success: boolean;
    error?: string;
  };
}

async function main() {
  const files = await fs.readdir(YAMLS_DIR);
  const yamlFiles = files.filter(
    (f) => f.endsWith('.yaml') || f.endsWith('.yml')
  );

  const reportData: ReportEntry[] = [];

  console.log(`Found ${yamlFiles.length} YAML files.`);

  for (const file of yamlFiles) {
    console.log(`Processing ${file}...`);
    const filePath = path.join(YAMLS_DIR, file);
    const content = await fs.readFile(filePath, 'utf8');

    const entry: ReportEntry = {
      file,
      dagre: { time: 0, svg: '', success: false },
      elk: { time: 0, svg: '', success: false },
    };

    // Dagre
    try {
      const res = await generateDiagramSvg(content, 'dagre');
      entry.dagre.time = res.duration;
      entry.dagre.svg = res.svg;
      entry.dagre.success = true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Error generating Dagre for ${file}:`, message);
      entry.dagre.error = message;
    }

    // Elk
    try {
      const res = await generateDiagramSvg(content, 'elk');
      entry.elk.time = res.duration;
      entry.elk.svg = res.svg;
      entry.elk.success = true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Error generating Elk for ${file}:`, message);
      entry.elk.error = message;
    }

    reportData.push(entry);
  }

  // Generate HTML
  let html = `
<!DOCTYPE html>
<html>
<head>
    <title>ADAC Graph Generation Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background-color: #f4f4f9; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #007bff; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        
        .collapsible {
            background-color: #eee;
            color: #444;
            cursor: pointer;
            padding: 18px;
            width: 100%;
            border: none;
            text-align: left;
            outline: none;
            font-size: 15px;
            transition: 0.4s;
            border-bottom: 1px solid #ddd;
            font-weight: bold;
        }
        
        .active, .collapsible:hover {
            background-color: #ccc;
        }
        
        .content {
            padding: 18px;
            display: none;
            overflow: hidden;
            background-color: white;
            border: 1px solid #ddd;
            border-top: none;
        }

        .svg-wrapper {
            margin-bottom: 20px;
        }
        .svg-wrapper h3 {
            margin-top: 0;
            color: #555;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>Graph Generation Report</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>

    <h2>Performance Summary</h2>
    <table>
        <thead>
            <tr>
                <th rowspan="2">File</th>
                <th colspan="2">Dagre</th>
                <th colspan="2">ElkJS</th>
            </tr>
            <tr>
                <th>Time (ms)</th>
                <th>Status</th>
                <th>Time (ms)</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
  `;

  for (const item of reportData) {
    html += `
        <tr>
            <td>${item.file}</td>
            <td>${item.dagre.success ? item.dagre.time : '-'}</td>
            <td style="color: ${item.dagre.success ? 'green' : 'red'}">${item.dagre.success ? 'Success' : 'Failed'}</td>
            <td>${item.elk.success ? item.elk.time : '-'}</td>
            <td style="color: ${item.elk.success ? 'green' : 'red'}">${item.elk.success ? 'Success' : 'Failed'}</td>
        </tr>
      `;
  }

  html += `
        </tbody>
    </table>

    <h2>Visual Comparison</h2>
  `;

  for (const item of reportData) {
    html += `
        <button type="button" class="collapsible">${item.file}</button>
        <div class="content">
            <div class="svg-wrapper">
                <h3>Dagre Layout (${item.dagre.time}ms)</h3>
                ${item.dagre.success ? item.dagre.svg : `<p class="error">Failed: ${item.dagre.error}</p>`}
            </div>
             <div class="svg-wrapper">
                <h3>ElkJS Layout (${item.elk.time}ms)</h3>
                ${item.elk.success ? item.elk.svg : `<p class="error">Failed: ${item.elk.error}</p>`}
            </div>
        </div>
      `;
  }

  html += `
    <script>
        var coll = document.getElementsByClassName("collapsible");
        var i;
        for (i = 0; i < coll.length; i++) {
            coll[i].addEventListener("click", function() {
                this.classList.toggle("active");
                var content = this.nextElementSibling;
                if (content.style.display === "block") {
                    content.style.display = "none";
                } else {
                    content.style.display = "block";
                }
            });
        }
    </script>
</body>
</html>
  `;

  await fs.outputFile(OUTPUT_FILE, html);
  console.log(`Report generated at ${OUTPUT_FILE}`);
}

main().catch(console.error);
