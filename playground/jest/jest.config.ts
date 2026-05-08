import { defineConfig } from 'jest';

export default defineConfig({
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  coverageReporters: ['none'], // disable Jest reporters
  reporters: ['default', '@pokujs/coverage/jest'],
  coverageProvider: 'v8',
});
