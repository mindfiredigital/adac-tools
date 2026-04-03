import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const releasesDir = path.resolve(root, 'releases');

async function pack() {
  console.log('🚀 Starting release pack process...');

  // Ensure releases directory exists
  await fs.ensureDir(releasesDir);
  await fs.emptyDir(releasesDir);

  const packages = [
    { name: 'core', path: 'packages/core' },
    { name: 'diagram', path: 'packages/diagram' },
  ];

  for (const pkg of packages) {
    console.log(`\n📦 Packing ${pkg.name}...`);
    const pkgPath = path.resolve(root, pkg.path);

    // 1. Build
    console.log(`🔨 Building ${pkg.name}...`);
    execSync('pnpm run build', { cwd: pkgPath, stdio: 'inherit' });

    // 2. Pack
    console.log(`⭐ Running pack...`);
    const packOutput = execSync('pnpm pack --json', { cwd: pkgPath })
      .toString()
      .trim();
    // Parse JSON reliably, ignoring potential warnings before the JSON object
    const jsonStart = packOutput.indexOf('{');
    let tarball = '';
    if (jsonStart !== -1) {
      const packJson = JSON.parse(packOutput.substring(jsonStart));
      tarball = packJson.filename;
    }

    if (tarball) {
      const src = path.join(pkgPath, tarball);
      const dest = path.join(releasesDir, tarball);
      await fs.move(src, dest, { overwrite: true });
      console.log(`✅ Created: releases/${tarball}`);
    } else {
      console.error(`❌ Error: Could not find tarball for ${pkg.name}`);
    }
  }

  // ── 2. Pack VS Code extension (.vsix) ───────────────────
  console.log('\n📦 Packing VS Code extension...');
  const vscodePath = path.resolve(root, 'packages/vscode');

  // Build the extension
  console.log('🔨 Building VS Code extension...');
  execSync('node esbuild.js --production', {
    cwd: vscodePath,
    stdio: 'inherit',
  });

  // Package as .vsix (npx to avoid needing vsce globally installed)
  console.log('⭐ Creating .vsix package...');
  execSync('echo "y" | npx @vscode/vsce package --no-dependencies', {
    cwd: vscodePath,
    stdio: 'inherit',
  });

  // Find and move .vsix to releases folder (deterministic: pick newest)
  const vscodeFiles = (await fs.readdir(vscodePath))
    .filter((f) => f.endsWith('.vsix'))
    .map((name) => ({
      name,
      time: fs.statSync(path.join(vscodePath, name)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  const vsix = vscodeFiles.length > 0 ? vscodeFiles[0].name : null;

  if (vsix) {
    const src = path.join(vscodePath, vsix);
    const dest = path.join(releasesDir, vsix);
    await fs.move(src, dest, { overwrite: true });
    console.log(`✅ Created: releases/${vsix}`);
  } else {
    console.error('❌ Error: Could not find .vsix file');
  }

  // ── Summary ─────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('📋 RELEASE ARTIFACTS');
  console.log('─'.repeat(60));
  const artifacts = await fs.readdir(releasesDir);
  for (const file of artifacts) {
    const stat = await fs.stat(path.join(releasesDir, file));
    const size = (stat.size / 1024).toFixed(1);
    console.log(`  📄 ${file} (${size} KB)`);
  }
  console.log(`\n✨ ${artifacts.length} artifacts packed in /releases`);
}

pack().catch((err) => {
  console.error('❌ Pack failed:', err);
  process.exit(1);
});
