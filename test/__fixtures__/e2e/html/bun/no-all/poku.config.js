import { defineConfig } from 'poku';
import { coverage } from '../../../../../../lib/index.js';

export default defineConfig({
  quiet: true,
  plugins: [
    coverage({
      include: ['src/**'],
      exclude: ['src/dummy.js'],
      reporter: ['html'],
      all: false,
    }),
  ],
});
