import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  // Bundle internal workspace packages
  noExternal: ['@mindfiredigital/adac-core', '@mindfiredigital/adac-cli'],
  // Keep these as external dependencies
  external: ['elkjs', 'fs-extra'],
  // Fix for __dirname in bundled code
  shims: true,
  async onSuccess() {
    const fs = await import('fs-extra');
    const path = await import('path');
    const root = process.cwd();
    await fs.copy(
      path.resolve(root, 'src/mappings'),
      path.resolve(root, 'dist/mappings')
    );
    console.log('✅ Mappings copied to dist');
  },
});
