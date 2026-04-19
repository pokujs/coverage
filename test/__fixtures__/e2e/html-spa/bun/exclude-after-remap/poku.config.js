import { defineConfig } from 'poku';
import { coverage } from '../../../../../../lib/index.js';

export default defineConfig({
  quiet: true,
  plugins: [
    coverage({
      exclude: ['**/transpiled.js'],
      excludeAfterRemap: true,
      reporter: ['html-spa'],
    }),
  ],
});
