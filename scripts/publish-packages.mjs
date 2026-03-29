/**
 * publish-packages.mjs
 *
 * Iterates over every workspace package that is NOT private and
 * publishes it to the GitHub Packages npm registry.
 *
 * Usage:
 *   node scripts/publish-packages.mjs            # actual publish
 *   node scripts/publish-packages.mjs --dry-run   # dry run
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const packagesDir = path.resolve(root, 'packages');

const dryRun = process.argv.includes('--dry-run');

// ─── Helpers ───────────────────────────────────────────────
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function isPublishable(pkgJson) {
  // Skip private packages
  if (pkgJson.private) return false;
  // Must have a name under @mindfiredigital scope
  if (!pkgJson.name?.startsWith('@mindfiredigital/')) return false;
  return true;
}

function isAlreadyPublished(name, version) {
  try {
    execSync(
      `npm view ${name}@${version} version --registry=https://npm.pkg.github.com`,
      {
        stdio: 'pipe',
      }
    );
    return true; // version already exists
  } catch {
    return false; // not yet published
  }
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 ADAC Monorepo Publisher ${dryRun ? '(DRY RUN)' : ''}\n`);
  console.log('─'.repeat(60));

  const dirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const results = { published: [], skipped: [], failed: [] };

  for (const dir of dirs) {
    const pkgJsonPath = path.join(packagesDir, dir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      continue;
    }

    const pkgJson = readJson(pkgJsonPath);

    if (!isPublishable(pkgJson)) {
      console.log(
        `⏭️  ${pkgJson.name || dir} — private or not scoped, skipping`
      );
      results.skipped.push(pkgJson.name || dir);
      continue;
    }

    const { name, version } = pkgJson;

    // Check if this version is already published
    if (isAlreadyPublished(name, version)) {
      console.log(`✅ ${name}@${version} — already published, skipping`);
      results.skipped.push(`${name}@${version}`);
      continue;
    }

    console.log(`📦 Publishing ${name}@${version}...`);

    const pkgDir = path.join(packagesDir, dir);

    try {
      if (dryRun) {
        console.log(
          `   🏜️  Would run: pnpm publish --access public --no-git-checks in ${dir}`
        );
      } else {
        execSync(
          'pnpm publish --access public --no-git-checks --registry=https://npm.pkg.github.com',
          {
            cwd: pkgDir,
            stdio: 'inherit',
            env: { ...process.env },
          }
        );
      }
      console.log(`   ✅ ${name}@${version} published successfully`);
      results.published.push(`${name}@${version}`);
    } catch (err) {
      console.error(
        `   ❌ Failed to publish ${name}@${version}: ${err.message}`
      );
      results.failed.push(`${name}@${version}`);
    }
  }

  // ── Summary ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('📋 SUMMARY');
  console.log('─'.repeat(60));
  console.log(`  Published: ${results.published.length}`);
  results.published.forEach((p) => console.log(`    ✅ ${p}`));
  console.log(`  Skipped:   ${results.skipped.length}`);
  results.skipped.forEach((s) => console.log(`    ⏭️  ${s}`));
  console.log(`  Failed:    ${results.failed.length}`);
  results.failed.forEach((f) => console.log(`    ❌ ${f}`));

  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
