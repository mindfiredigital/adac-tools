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
    execSync('pnpm pack', { cwd: pkgPath, stdio: 'inherit' });

    // 3. Move .tgz to releases folder
    const files = await fs.readdir(pkgPath);
    const tarball = files.find((f) => f.endsWith('.tgz'));

    if (tarball) {
      const src = path.join(pkgPath, tarball);
      const dest = path.join(releasesDir, tarball);
      await fs.move(src, dest, { overwrite: true });
      console.log(`✅ Created: releases/${tarball}`);
    } else {
      console.error(`❌ Error: Could not find tarball for ${pkg.name}`);
    }
  }

  console.log('\n✨ All releases packed in /releases folder');
}

pack().catch((err) => {
  console.error('❌ Pack failed:', err);
  process.exit(1);
});
