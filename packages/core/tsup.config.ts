import { defineConfig } from 'tsup';

// The ES module bundle contains CommonJS modules (the layout builder, fs-extra
// and what it uses) that call require(), and ES modules have no require: esbuild
// replaces each call with a shim that throws "Dynamic require of ... is not
// supported", so the file could not even be loaded in Node. In Node this gives
// the bundle a real require. In a browser it is skipped (no process.versions.node
// there), so the bundle gets no Node import that a browser bundler would reject.
const ESM_REQUIRE = [
  "const require = typeof process !== 'undefined' && process.versions && process.versions.node",
  "  ? (await import('node:module')).createRequire(import.meta.url)",
  '  : undefined;',
].join('\n');

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  // the published types must not import the unpublished workspace packages;
  // the validator is a dependency, so its import stays. The second pattern
  // lets the bundler follow the relative imports inside those packages' own
  // declaration files; without it they stay as './types.js' in the output.
  dts: {
    resolve: [
      /^@mindfiredigital\/adac-(parser|layout-core|layout-elk)$/,
      /^\.\.?\//,
    ],
  },
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  // the ES module build reads __dirname to find the icon packages
  shims: true,
  esbuildOptions(options, { format }) {
    if (format === 'esm') options.banner = { js: ESM_REQUIRE };
  },
  // Bundle internal workspace packages and key external dependencies
  noExternal: [
    '@mindfiredigital/adac-parser',
    '@mindfiredigital/adac-layout-core',
    '@mindfiredigital/adac-layout-elk',
    'elkjs',
    'fs-extra',
  ],
  external: ['web-worker'],
});
