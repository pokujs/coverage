import { defineConfig } from 'poku';
import { coverage } from '../../../../../../lib/index.js';

export default defineConfig({
  quiet: true,
  plugins: [
    coverage({
      include: ['src/**'],
      reporter: ['html-spa'],
      all: true,
      skipEmpty: true,
    }),
  ],
});
