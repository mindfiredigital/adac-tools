import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(
  __dirname,
  'frontend/public/assets/Architecture-Service-Icons_07312025'
);
const OUTPUT_FILE = path.join(__dirname, 'frontend/public/icons.json');

const getIcons = (dir) => {
  let results = [];
  console.log('Reading dir:', dir);
  if (!fs.existsSync(dir)) {
    console.error('Dir does not exist:', dir);
    return [];
  }
  const items = fs.readdirSync(dir, { withFileTypes: true });
  console.log('Found items:', items.length);

  for (const item of items) {
    console.log('Checking:', item.name, 'IsDir:', item.isDirectory());
    if (item.isDirectory()) {
      const categoryObj = {
        category: item.name,
        icons: [],
      };

      // Read files in this category
      const subDir = path.join(dir, item.name, '48');
      if (fs.existsSync(subDir)) {
        const files = fs.readdirSync(subDir);
        files.forEach((f) => {
          // Filter for images
          if (f.endsWith('.png') || f.endsWith('.svg')) {
            // Create relative path for frontend
            // frontend/public/assets/... -> /assets/...
            const relPath = `/assets/Architecture-Service-Icons_07312025/${item.name}/48/${f}`;
            categoryObj.icons.push({
              name: f,
              path: relPath,
            });
          }
        });
      } else {
        console.log('No 48 folder in', item.name);
      }

      if (categoryObj.icons.length > 0) {
        results.push(categoryObj);
      }
    }
  }
  return results;
};

const icons = getIcons(ASSETS_DIR);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(icons, null, 2));
console.log(`Generated ${OUTPUT_FILE} with ${icons.length} categories.`);
