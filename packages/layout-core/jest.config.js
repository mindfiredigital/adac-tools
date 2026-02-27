const { createDefaultPreset } = require('ts-jest');

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    ...tsJestTransformCfg,
    // This tells ts-jest specifically which config to use during execution
    '^.+.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
