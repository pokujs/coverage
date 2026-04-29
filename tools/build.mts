import type { BuildOptions } from 'esbuild';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { generateDtsBundle } from 'dts-bundle-generator';
import { build } from 'esbuild';

const [dtsBundle] = generateDtsBundle(
  [
    {
      filePath: 'src/index.ts',
      output: { noBanner: true },
    },
  ],
  { preferredConfigPath: 'tsconfig.json' }
);

const buildOptions: BuildOptions = {
  bundle: true,
  platform: 'node',
  target: 'node16',
  logLevel: 'info',
  treeShaking: true,
  format: 'cjs',
};

await rm('lib', { recursive: true, force: true });
await mkdir('lib', { recursive: true });
await Promise.all([
  build({
    ...buildOptions,
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.js',
    minifySyntax: true,
  }),
  build({
    ...buildOptions,
    entryPoints: ['src/runtimes/bun/preload.ts'],
    outfile: 'lib/preload-bun.js',
    minify: true,
  }),
  build({
    ...buildOptions,
    entryPoints: ['src/bin/cli.ts'],
    outfile: 'lib/bin/cli.js',
    banner: { js: '#!/usr/bin/env node' },
    minifySyntax: true,
    external: ['../index.js'],
  }),
  writeFile('lib/index.d.ts', dtsBundle, 'utf-8'),
]);

await chmod('lib/bin/cli.js', 0o755);
