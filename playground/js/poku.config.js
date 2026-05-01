import { defineConfig } from 'poku';
import { coverage } from '../../lib/index.js';

export default defineConfig({
  quiet: true,
  plugins: [
    coverage({
      include: ['src/**'],
      exclude: ['src/dummy.js'],
      all: true,
      reporter: [
        'text',
        // 'lcov',
        // 'jsc',
        'v8',
        'lcovonly',
        // 'html',
        // 'html-spa',
        // 'json',
        // 'text-summary',
        // 'text-lcov',
        // 'teamcity',
        // 'json-summary',
        // 'cobertura',
        // 'clover',
      ],
      hyperlinks: 'vscode',
      checkCoverage: true,
      statements: 80.64,
      functions: 96.428,
      lines: 80.64,
    }),
  ],
});
