// @ts-check

// import { writeFileSync } from 'node:fs';
import { cp, readdir, rm } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { basename, join } from 'node:path';
import { env } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'poku';
// import { createReporter } from 'poku/plugins';
import { coverage } from './lib/index.js';

// /**
//  * @type {{ path: string; status: boolean; duration: number; }[]}
//  */
// const fileResults = [];

// export const reporter = createReporter({
//   onFileResult({ status, path, duration }) {
//     fileResults.push({ path: path.relative, status, duration });
//   },
//   onExit({ code, timespan }) {
//     writeFileSync(
//       'test-results.json',
//       JSON.stringify(
//         {
//           code,
//           duration: timespan.duration,
//           files: fileResults,
//         },
//         null,
//         2
//       )
//     );
//   },
// });

const fixturesRoot = fileURLToPath(
  new URL('./test/__fixtures__/e2e/', import.meta.url)
);

const snapshotsRoot = fileURLToPath(
  new URL('./test/__snapshots__/e2e/', import.meta.url)
);

const reportersResourcesRoot = fileURLToPath(
  new URL('./test/__resources__/e2e/reporters/', import.meta.url)
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

export default defineConfig({
  include: ['test/e2e'],
  // reporter: reporter,
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
      all: true,
      include: ['lib'],
      exclude: ['@types', '*.ts'],
    }),
  ],
});
