/**
 * setup-publish-config.mjs
 *
 * Adds `repository` and `publishConfig` fields to all workspace
 * package.json files that are missing them. This is required for
 * GitHub Packages npm publishing.
 *
 * Usage:  node scripts/setup-publish-config.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const packagesDir = path.resolve(root, 'packages');

const REPO_URL = 'https://github.com/mindfiredigital/adac-tools.git';

function main() {
  const dirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let updated = 0;

  for (const dir of dirs) {
    const pkgPath = path.join(packagesDir, dir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);

    // Skip private packages
    if (pkg.private) {
      console.log(`⏭️  ${pkg.name} — private, skipping`);
      continue;
    }

    let changed = false;

    // Add repository if missing
    if (!pkg.repository) {
      pkg.repository = {
        type: 'git',
        url: REPO_URL,
        directory: `packages/${dir}`,
      };
      changed = true;
    }

    // Add publishConfig if missing
    if (!pkg.publishConfig) {
      pkg.publishConfig = {
        access: 'public',
        registry: 'https://npm.pkg.github.com',
      };
      changed = true;
    } else if (!pkg.publishConfig.registry) {
      pkg.publishConfig.registry = 'https://npm.pkg.github.com';
      changed = true;
    }

    // Ensure "files" field exists so only dist is published
    if (!pkg.files) {
      pkg.files = ['dist'];
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      console.log(`✅ ${pkg.name} — updated`);
      updated++;
    } else {
      console.log(`✔️  ${pkg.name} — already configured`);
    }
  }

  console.log(`\n📦 Updated ${updated} package(s).`);
}

main();
