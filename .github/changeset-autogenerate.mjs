import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 🚨 Prevent duplicate changesets
if (fs.existsSync('.changeset')) {
  const existing = fs
    .readdirSync('.changeset')
    .filter((f) => f.endsWith('.md') && f !== 'README.md');
  if (existing.length > 0) {
    console.log('⚠️ Changeset already exists, skipping generation');
    process.exit(0);
  }
}

// Skip merge commits (commits with more than one parent)
const parents = execSync('git log -1 --format=%P').toString().trim().split(' ');
if (parents.length > 1) {
  console.log('ℹ️ Merge commit detected, skipping changeset generation');
  process.exit(0);
}

// Get latest commit message
const commitMessage = execSync('git log -1 --format=%s').toString().trim();
console.log(`📝 Processing commit message: "${commitMessage}"`);

// Pattern: type(scope)!: description
const commitPattern = /^(\w+)(?:\(([^)]+)\))?(!?): (.+)/;
const match = commitMessage.match(commitPattern);

if (!match) {
  console.log(
    '⚠️ Commit message does not follow conventional commits (type(scope): description), skipping'
  );
  process.exit(0);
}

const [, type, scope, breaking, description] = match;
const isBreaking = breaking === '!' || /BREAKING CHANGE/.test(commitMessage);

let changeType = 'patch';
if (isBreaking) {
  changeType = 'major';
} else if (type === 'feat') {
  changeType = 'minor';
} else if (type === 'fix') {
  changeType = 'patch';
} else {
  console.log(
    `ℹ️ Commit type "${type}" usually doesn't trigger a release, skipping`
  );
  process.exit(0);
}

// Map scope to package name
const packagesDir = path.join(process.cwd(), 'packages');
const availablePackages = fs.readdirSync(packagesDir);

let targetPackages = [];

if (scope === 'all' || scope === 'monorepo') {
  // Add all valid packages
  for (const p of availablePackages) {
    const pkgPath = path.join(packagesDir, p, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      targetPackages.push(pkgJson.name);
    }
  }
} else if (!scope) {
  // If no scope, default to core
  if (availablePackages.includes('core')) {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(packagesDir, 'core', 'package.json'), 'utf8')
    );
    targetPackages.push(pkgJson.name);
  }
} else if (availablePackages.includes(scope)) {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(packagesDir, scope, 'package.json'), 'utf8')
  );
  targetPackages.push(pkgJson.name);
} else {
  // Try to find if any package name ends with the scope
  for (const p of availablePackages) {
    const pkgPath = path.join(packagesDir, p, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkgJson.name.endsWith(`-${scope}`) || pkgJson.name === scope) {
        targetPackages.push(pkgJson.name);
        break;
      }
    }
  }
}

if (targetPackages.length === 0) {
  console.log(`⚠️ Could not map scope "${scope}" to any package, skipping`);
  process.exit(0);
}

const changesetContent = `---\n${targetPackages.map((p) => `'${p}': ${changeType}`).join('\n')}\n---\n\n${description}\n`;
const fileName = `.changeset/auto-${Date.now()}.md`;

if (!fs.existsSync('.changeset')) {
  fs.mkdirSync('.changeset');
}

fs.writeFileSync(fileName, changesetContent);
console.log(
  `✅ Changeset created → ${targetPackages.join(', ')} (${changeType})`
);
