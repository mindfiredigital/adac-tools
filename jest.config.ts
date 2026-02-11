export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/index.ts',
    '!packages/web/**',
    '!packages/vscode/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  moduleNameMapper: {
    '^@mindfiredigital/adac-schema$': '<rootDir>/packages/schema/src/index.ts',
    '^@mindfiredigital/adac-parser$': '<rootDir>/packages/parser/src/index.ts',
    '^@mindfiredigital/adac-layout-core$':
      '<rootDir>/packages/layout-core/src/index.ts',
    '^@mindfiredigital/adac-layout-elk$':
      '<rootDir>/packages/layout-elk/src/index.ts',
    '^@mindfiredigital/adac-layout-dagre$':
      '<rootDir>/packages/layout-dagre/src/index.ts',
    '^@mindfiredigital/adac-diagram$':
      '<rootDir>/packages/diagram/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
        useESM: false,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
