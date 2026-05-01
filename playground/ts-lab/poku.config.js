import { coverage } from '@pokujs/coverage';
import { defineConfig } from 'poku';

export default defineConfig({
  quiet: true,
  plugins: [
    coverage({
      include: ['src/**'],
      all: true,
      reporter: ['types'],
      hyperlinks: 'vscode',
    }),
  ],
});
