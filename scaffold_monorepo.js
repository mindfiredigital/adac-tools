const fs = require('fs');
const path = require('path');

const packages = [
  // Level 0
  'schema',
  'layout-core',
  'icons-aws',
  'icons-azure',
  'icons-gcp',
  'templates',
  // Level 1
  'parser',
  'layout',
  'layout-elk',
  // Level 2
  'diagram',
  'doc',
  'cost',
  'compliance',
  'export-terraform',
  'export-cloudformation',
  'export-k8s',
  // Level 3
  'optimizer',
  'vscode',
  'web-server',
  // Level 4
  'cli',
  'web',
];

const packagesDir = path.join(process.cwd(), 'packages');

if (!fs.existsSync(packagesDir)) {
  fs.mkdirSync(packagesDir);
  console.log('Created packages directory');
}

packages.forEach((pkg) => {
  const pkgDir = path.join(packagesDir, pkg);
  if (!fs.existsSync(pkgDir)) {
    fs.mkdirSync(pkgDir);
    console.log(`Created package directory: ${pkg}`);
  }

  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    const pkgJson = {
      name: `@mindfiredigital/adac-${pkg}`,
      version: '0.0.1',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        build: 'tsc',
        test: 'vitest run',
      },
      license: 'ISC',
    };
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
    console.log(`Created package.json for ${pkg}`);
  }

  // Create src folder
  const srcDir = path.join(pkgDir, 'src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir);
    fs.writeFileSync(
      path.join(srcDir, 'index.ts'),
      `// Entry point for @mindfiredigital/adac-${pkg}`
    );
    console.log(`Created src/index.ts for ${pkg}`);
  }

  // Create tsconfig.json
  const tsConfigPath = path.join(pkgDir, 'tsconfig.json');
  if (!fs.existsSync(tsConfigPath)) {
    const tsConfig = {
      extends: '../../tsconfig.json',
      compilerOptions: {
        outDir: './dist',
        rootDir: './src',
      },
      include: ['src/**/*'],
    };
    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
  }
});
