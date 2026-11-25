import { defineConfig } from 'tsup';

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
