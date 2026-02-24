const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src/mappings');
const destDir = path.resolve(__dirname, '../dist/mappings');

console.log(`Copying assets from ${srcDir} to ${destDir}...`);

if (!fs.existsSync(srcDir)) {
  console.warn(`Source directory ${srcDir} does not exist. Skipping copy.`);
  process.exit(0);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
files.forEach(file => {
  const srcFile = path.join(srcDir, file);
  const destFile = path.join(destDir, file);
  if (fs.statSync(srcFile).isFile()) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`Copied ${file}`);
  }
});
