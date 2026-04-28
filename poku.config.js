// @ts-check

'use strict';

const { cp, readdir, rm } = require('node:fs/promises');
const { homedir, platform } = require('node:os');
const { basename, join } = require('node:path');
const { env } = require('node:process');
const { defineConfig } = require('poku');
const { coverage } = require('./lib/index.js');

const fixturesRoot = join(__dirname, 'test', '__fixtures__', 'e2e');
const snapshotsRoot = join(__dirname, 'test', '__snapshots__', 'e2e');
const reportersResourcesRoot = join(
  __dirname,
  'test',
  '__resources__',
  'e2e',
  'reporters'
);

const reportersResourceByCase = new Map([
  ['exclude-after-remap', 'exclude-remap'],
  ['exclude-before-remap', 'exclude-remap'],
  ['skip-empty', 'skip-empty'],
]);

const clean = async (directory = fixturesRoot) => {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map((entry) => {
      if (!entry.isDirectory()) return;

      const entryPath = join(directory, entry.name);

      if (
        entry.name === 'coverage' ||
        entry.name === 'src' ||
        entry.name === 'test'
      ) {
        return rm(entryPath, { recursive: true, force: true });
      }

      return clean(entryPath);
    })
  );
};

const hydrate = async (directory = fixturesRoot) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const hasPokuConfig = entries.some(
    (entry) => entry.isFile() && entry.name === 'poku.config.js'
  );

  if (hasPokuConfig) {
    const caseName = basename(directory);
    const resourceName = reportersResourceByCase.get(caseName) ?? 'base';
    const resourceDirectory = join(reportersResourcesRoot, resourceName);

    await cp(resourceDirectory, directory, { recursive: true, force: true });
    return;
  }

  await Promise.all(
    entries.map((entry) => {
      if (!entry.isDirectory()) return;
      return hydrate(join(directory, entry.name));
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
  console.log('› Clearing Deno cache...');

  try {
    await rm(denoCacheDir(), { recursive: true, force: true });
  } catch {}
};

const clearPlatformSnapshots = async (directory = snapshotsRoot) => {
  const currentPlatform = platform();
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map((entry) => {
      if (!entry.isDirectory()) return;

      const entryPath = join(directory, entry.name);

      if (entry.name === currentPlatform) {
        return rm(entryPath, { recursive: true, force: true });
      }

      return clearPlatformSnapshots(entryPath);
    })
  );
};

module.exports = defineConfig({
  include: ['test/e2e'],
  reporter: 'compact',
  timeout: 30000,
  deno: {
    allow: ['all'],
  },
  plugins: [
    {
      setup: async () => {
        await clearRuntimeCaches();

        if (env.UPDATE_SNAPSHOTS === '1') {
          console.log(
            `› Clearing existing snapshots for platform "${platform()}"...`
          );
          await clearPlatformSnapshots();
        }

        console.log('› Deleting previous coverage reports and fixtures...');
        await clean();

        console.log('› Hydrating fixtures from resources...');
        await hydrate();
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
      reporter: ['text'],
      all: true,
      include: ['lib'],
    }),
  ],
});
