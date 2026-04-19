// @ts-check

import { readdir, rm } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { env } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'poku';
import { coverage } from './lib/index.js';

const clean = async (
  directory = fileURLToPath(
    new URL('./test/__fixtures__/e2e/', import.meta.url)
  )
) => {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map((entry) => {
      if (!entry.isDirectory()) return;

      const entryPath = join(directory, entry.name);

      if (entry.name === 'coverage') {
        return rm(entryPath, { recursive: true, force: true });
      }

      return clean(entryPath);
    })
  );
};

const denoCacheDir = () => {
  switch (platform()) {
    case 'darwin':
      return join(homedir(), 'Library', 'Caches', 'deno');
    case 'win32':
      return join(
        env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
        'deno'
      );
    default:
      return join(homedir(), '.cache', 'deno');
  }
};

const clearRuntimeCaches = async () => {
  console.log('› Clearing Deno cache for snapshot regeneration...');
  await rm(denoCacheDir(), { recursive: true, force: true });
};

export default defineConfig({
  include: ['test/e2e'],
  reporter: 'compact',
  timeout: 30000,
  plugins: [
    {
      setup: async () => {
        await clearRuntimeCaches();

        console.log('› Deleting previous coverage reports and fixtures...');
        await clean();
        console.log('');
      },
      teardown: () => {
        console.log('');
        console.log(
          '› Coverage reports and fixtures are preserved for debugging purposes.'
        );
      },
    },
    coverage({
      requireFlag: true,
      all: true,
      include: ['lib'],
      exclude: ['@types', '*.ts'],
    }),
  ],
});
